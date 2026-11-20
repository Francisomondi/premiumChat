
import mongoose from "mongoose";

import CreatorProfile, {
  CREATOR_APPLICATION_STATUSES,
} from "../models/CreatorProfile.model.js";

import CreatorSubscription, {
  SUBSCRIPTION_STATUSES,
} from "../models/CreatorSubscription.model.js";

import PaymentTransaction, {
  PAYMENT_STATUSES,
} from "../models/PaymentTransaction.model.js";

import {
  USER_ROLES,
  USER_STATUSES,
} from "../models/User.model.js";

const PENDING_RESERVATION_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

const CREATOR_SUMMARY_FIELDS =
  "username displayName country";

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validateClientRequestId(clientRequestId) {
  if (
    typeof clientRequestId !== "string" ||
    clientRequestId.trim().length < 16 ||
    clientRequestId.trim().length > 100
  ) {
    throw createHttpError(
      400,
      "A valid client request ID between 16 and 100 characters is required.",
    );
  }

  return clientRequestId.trim();
}

function validateSubscriptionId(subscriptionId) {
  if (!mongoose.isValidObjectId(subscriptionId)) {
    throw createHttpError(400, "Invalid subscription ID.");
  }
}

function normalizePagination(page, limit) {
  const parsedPage = Number.parseInt(page, 10);
  const parsedLimit = Number.parseInt(limit, 10);

  return {
    page:
      Number.isInteger(parsedPage) && parsedPage > 0
        ? Math.min(parsedPage, 100000)
        : 1,
    limit:
      Number.isInteger(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, MAX_PAGE_SIZE)
        : DEFAULT_PAGE_SIZE,
  };
}

function getEffectiveStatus(subscription, now = new Date()) {
  if (
    subscription.status === SUBSCRIPTION_STATUSES.ACTIVE &&
    subscription.expiresAt &&
    new Date(subscription.expiresAt) <= now
  ) {
    return SUBSCRIPTION_STATUSES.EXPIRED;
  }

  return subscription.status;
}

function formatCreator(profile) {
  if (!profile) {
    return null;
  }

  return {
    id: String(profile._id),
    username: profile.username,
    displayName: profile.displayName,
    country: profile.country,
  };
}

function formatSubscription(subscription) {
  return {
    id: String(subscription._id),
    creatorId: String(subscription.creatorId),
    creatorProfileId: String(subscription.creatorProfileId),
    creator: formatCreator(subscription.creatorProfileId),
    amountKes: subscription.amountKes,
    currency: subscription.currency,
    status: getEffectiveStatus(subscription),
    startedAt: subscription.startedAt,
    expiresAt: subscription.expiresAt,
    cancelledAt: subscription.cancelledAt,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  };
}

function formatReservation(subscription) {
  return {
    id: String(subscription._id),
    creatorId: String(subscription.creatorId),
    creatorProfileId: String(subscription.creatorProfileId),
    amountKes: subscription.amountKes,
    currency: subscription.currency,
    status: subscription.status,
    startedAt: subscription.startedAt,
    expiresAt: subscription.expiresAt,
    createdAt: subscription.createdAt,
  };
}

function assertActiveFan(fan) {
  if (
    !fan ||
    fan.role !== USER_ROLES.FAN ||
    fan.status !== USER_STATUSES.ACTIVE ||
    !fan.ageVerifiedAt
  ) {
    throw createHttpError(
      403,
      "An active, age-verified fan account is required.",
    );
  }
}

function assertSubscriptionOwner(subscription, fanId) {
  if (!subscription) {
    throw createHttpError(404, "Subscription not found.");
  }

  if (String(subscription.fanId) !== String(fanId)) {
    throw createHttpError(404, "Subscription not found.");
  }
}

export async function reserveCreatorSubscription({
  fan,
  creatorProfileId,
  clientRequestId,
}) {
  assertActiveFan(fan);

  if (!mongoose.isValidObjectId(creatorProfileId)) {
    throw createHttpError(400, "Invalid creator profile ID.");
  }

  const requestId = validateClientRequestId(clientRequestId);

  const existingRequest = await CreatorSubscription.findOne({
    fanId: fan._id,
    clientRequestId: requestId,
  });

  if (existingRequest) {
    if (
      String(existingRequest.creatorProfileId) !==
      String(creatorProfileId)
    ) {
      throw createHttpError(
        409,
        "This request ID has already been used for another creator.",
      );
    }

    return {
      reservation: formatReservation(existingRequest),
      reused: true,
    };
  }

  const creatorProfile = await CreatorProfile.findOne({
    _id: creatorProfileId,
    applicationStatus: CREATOR_APPLICATION_STATUSES.APPROVED,
  }).populate({
    path: "userId",
    select: "role status ageVerifiedAt",
    match: {
      role: USER_ROLES.CREATOR,
      status: USER_STATUSES.ACTIVE,
      ageVerifiedAt: { $ne: null },
    },
  });

  if (!creatorProfile || !creatorProfile.userId) {
    throw createHttpError(404, "Creator profile not found.");
  }

  if (!creatorProfile.subscriptionsEnabled) {
    throw createHttpError(
      409,
      "This creator is not currently accepting subscriptions.",
    );
  }

  const amountKes = creatorProfile.monthlySubscriptionPriceKes;

  if (
    !Number.isSafeInteger(amountKes) ||
    amountKes < 1 ||
    amountKes > 100000
  ) {
    throw createHttpError(
      409,
      "This creator's subscription price is not configured correctly.",
    );
  }

  const creatorId = creatorProfile.userId._id;
  const now = new Date();

  const activeSubscription = await CreatorSubscription.exists({
    fanId: fan._id,
    creatorId,
    status: SUBSCRIPTION_STATUSES.ACTIVE,
    expiresAt: { $gt: now },
  });

  if (activeSubscription) {
    throw createHttpError(
      409,
      "You already have an active subscription to this creator.",
    );
  }

  const pendingSubscription = await CreatorSubscription.exists({
    fanId: fan._id,
    creatorId,
    status: SUBSCRIPTION_STATUSES.PENDING,
    createdAt: {
      $gt: new Date(now.getTime() - PENDING_RESERVATION_WINDOW_MS),
    },
  });

  if (pendingSubscription) {
    throw createHttpError(
      409,
      "You already have a pending subscription reservation for this creator.",
    );
  }

  try {
    const subscription = await CreatorSubscription.create({
      fanId: fan._id,
      creatorId,
      creatorProfileId: creatorProfile._id,
      clientRequestId: requestId,
      amountKes,
      currency: "KES",
      status: SUBSCRIPTION_STATUSES.PENDING,
    });

    return {
      reservation: formatReservation(subscription),
      reused: false,
    };
  } catch (error) {
    if (error.code === 11000) {
      const existing = await CreatorSubscription.findOne({
        fanId: fan._id,
        clientRequestId: requestId,
      });

      if (existing) {
        if (
          String(existing.creatorProfileId) !==
          String(creatorProfileId)
        ) {
          throw createHttpError(
            409,
            "This request ID has already been used for another creator.",
          );
        }

        return {
          reservation: formatReservation(existing),
          reused: true,
        };
      }

      throw createHttpError(
        409,
        "A subscription reservation already exists for this request.",
      );
    }

    throw error;
  }
}

/**
 * List only the authenticated fan's subscriptions.
 * Expired ACTIVE records are presented as EXPIRED without
 * mutating payment or subscription records during a read.
 */
export async function getMySubscriptions({
  fan,
  page,
  limit,
  status,
}) {
  assertActiveFan(fan);

  const pagination = normalizePagination(page, limit);
  const filter = { fanId: fan._id };

  const allowedStatuses = Object.values(SUBSCRIPTION_STATUSES);

  if (status) {
    if (!allowedStatuses.includes(status)) {
      throw createHttpError(400, "Invalid subscription status filter.");
    }

    if (status === SUBSCRIPTION_STATUSES.EXPIRED) {
      filter.$or = [
        { status: SUBSCRIPTION_STATUSES.EXPIRED },
        {
          status: SUBSCRIPTION_STATUSES.ACTIVE,
          expiresAt: { $lte: new Date() },
        },
      ];
    } else {
      filter.status = status;
    }
  }

  const skip = (pagination.page - 1) * pagination.limit;

  const [subscriptions, total] = await Promise.all([
    CreatorSubscription.find(filter)
      .populate({
        path: "creatorProfileId",
        select: CREATOR_SUMMARY_FIELDS,
      })
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(pagination.limit)
      .lean(),

    CreatorSubscription.countDocuments(filter),
  ]);

  return {
    subscriptions: subscriptions.map(formatSubscription),
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      pages: Math.ceil(total / pagination.limit),
    },
  };
}

/**
 * Retrieve one subscription, ensuring the requesting fan owns it.
 */
export async function getMySubscriptionById({
  fan,
  subscriptionId,
}) {
  assertActiveFan(fan);
  validateSubscriptionId(subscriptionId);

  const subscription = await CreatorSubscription.findById(subscriptionId)
    .populate({
      path: "creatorProfileId",
      select: CREATOR_SUMMARY_FIELDS,
    })
    .lean();

  assertSubscriptionOwner(subscription, fan._id);

  return {
    subscription: formatSubscription(subscription),
  };
}

/**
 * Return safe payment history for one subscription.
 * Sensitive phone and provider dispatch identifiers are never selected.
 */
export async function getMySubscriptionPayments({
  fan,
  subscriptionId,
  page,
  limit,
}) {
  assertActiveFan(fan);
  validateSubscriptionId(subscriptionId);

  const subscription = await CreatorSubscription.findById(subscriptionId)
    .select("_id fanId")
    .lean();

  assertSubscriptionOwner(subscription, fan._id);

  const pagination = normalizePagination(page, limit);
  const filter = {
    subscriptionId,
    fanId: fan._id,
    purpose: {
      $in: [
        "SUBSCRIPTION_INITIAL",
        "SUBSCRIPTION_RENEWAL",
      ],
    },
  };

  const skip = (pagination.page - 1) * pagination.limit;

  const [payments, total] = await Promise.all([
    PaymentTransaction.find(filter)
      .select(
        "paymentReference purpose amountKes currency status initiationStatus createdAt updatedAt initiatedAt verifiedAt failedAt",
      )
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(pagination.limit)
      .lean(),

    PaymentTransaction.countDocuments(filter),
  ]);

  return {
    payments: payments.map((payment) => ({
      id: String(payment._id),
      paymentReference: payment.paymentReference,
      purpose: payment.purpose,
      amountKes: payment.amountKes,
      currency: payment.currency,
      status: payment.status,
      initiationStatus: payment.initiationStatus,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      initiatedAt: payment.initiatedAt,
      verifiedAt: payment.verifiedAt,
      failedAt: payment.failedAt,
    })),
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      pages: Math.ceil(total / pagination.limit),
    },
  };
}

/**
 * Only safe pending reservations can be cancelled.
 *
 * An unresolved M-Pesa transaction may still settle successfully,
 * so it must not be cancelled through this endpoint.
 *
 * Active subscriptions are prepaid and do not auto-renew.
 */
export async function cancelMySubscription({
  fan,
  subscriptionId,
}) {
  assertActiveFan(fan);
  validateSubscriptionId(subscriptionId);

  const subscription = await CreatorSubscription.findOne({
    _id: subscriptionId,
    fanId: fan._id,
  });

  if (!subscription) {
    throw createHttpError(404, "Subscription not found.");
  }

  if (subscription.status === SUBSCRIPTION_STATUSES.ACTIVE) {
    throw createHttpError(
      409,
      "This subscription is already paid for and does not auto-renew. Your access remains available until its expiry date.",
    );
  }

  if (subscription.status !== SUBSCRIPTION_STATUSES.PENDING) {
    throw createHttpError(
      409,
      `A subscription with status ${subscription.status} cannot be cancelled.`,
    );
  }

  const latestPayment = await PaymentTransaction.findOne({
    subscriptionId: subscription._id,
    fanId: fan._id,
  })
    .sort({ createdAt: -1 })
    .select("status")
    .lean();

  if (
    latestPayment &&
    ![
      PAYMENT_STATUSES.FAILED,
      PAYMENT_STATUSES.CANCELLED,
    ].includes(latestPayment.status)
  ) {
    throw createHttpError(
      409,
      "This subscription has a payment that may still complete. Check its payment status before attempting cancellation.",
    );
  }

  const cancelledAt = new Date();

  const updatedSubscription = await CreatorSubscription.findOneAndUpdate(
    {
      _id: subscription._id,
      fanId: fan._id,
      status: SUBSCRIPTION_STATUSES.PENDING,
    },
    {
      $set: {
        status: SUBSCRIPTION_STATUSES.CANCELLED,
        cancelledAt,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  )
    .populate({
      path: "creatorProfileId",
      select: CREATOR_SUMMARY_FIELDS,
    })
    .lean();

  if (!updatedSubscription) {
    throw createHttpError(
      409,
      "The subscription changed while cancellation was being processed. Refresh and try again.",
    );
  }

  return {
    subscription: formatSubscription(updatedSubscription),
  };
}
