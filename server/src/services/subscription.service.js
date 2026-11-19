
import mongoose from "mongoose";

import CreatorProfile, {
  CREATOR_APPLICATION_STATUSES,
} from "../models/CreatorProfile.model.js";

import CreatorSubscription, {
  SUBSCRIPTION_STATUSES,
} from "../models/CreatorSubscription.model.js";

import {
  USER_ROLES,
  USER_STATUSES,
} from "../models/User.model.js";

const PENDING_RESERVATION_WINDOW_MS = 15 * 60 * 1000;

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
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

export async function reserveCreatorSubscription({
  fan,
  creatorProfileId,
  clientRequestId,
}) {
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

  if (!mongoose.isValidObjectId(creatorProfileId)) {
    throw createHttpError(400, "Invalid creator profile ID.");
  }

  const requestId = validateClientRequestId(clientRequestId);

  // Return the original reservation on an idempotent retry.
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
    // Handle simultaneous retries using the unique idempotency index.
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
