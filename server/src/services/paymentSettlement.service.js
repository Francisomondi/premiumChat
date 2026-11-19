
import mongoose from "mongoose";

import CreatorSubscription from "../models/CreatorSubscription.model.js";
import MediaPurchase from "../models/MediaPurchase.model.js";

import PaymentTransaction, {
  PAYMENT_PURPOSES,
  PAYMENT_STATUSES,
} from "../models/PaymentTransaction.model.js";

import MpesaFinancialVerification from "../models/MpesaFinancialVerification.model.js";

function createHttpError(
  message,
  status = 400,
  code = "PAYMENT_SETTLEMENT_ERROR",
) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function sameId(first, second) {
  return Boolean(first && second && String(first) === String(second));
}

// Add one calendar month while clamping to the final day of the target month.
// For example, January 31 becomes February 28 or 29.
function addOneCalendarMonth(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  const targetMonth = month + 1;
  const lastDay = new Date(year, targetMonth + 1, 0).getDate();

  return new Date(
    year,
    targetMonth,
    Math.min(day, lastDay),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
}

async function validateVerifiedPayment(paymentId, session) {
  const payment = await PaymentTransaction.findById(paymentId)
    .session(session);

  if (!payment) {
    throw createHttpError(
      "Payment transaction was not found.",
      404,
      "PAYMENT_NOT_FOUND",
    );
  }

  if (payment.status !== PAYMENT_STATUSES.SUCCEEDED) {
    throw createHttpError(
      "Only successfully verified payments can be settled.",
      409,
      "PAYMENT_NOT_VERIFIED",
    );
  }

  if (!payment.verifiedAt) {
    throw createHttpError(
      "The payment has no financial verification timestamp.",
      409,
      "PAYMENT_VERIFICATION_MISSING",
    );
  }

  const evidence = await MpesaFinancialVerification.findOne({
    paymentTransactionId: payment._id,
  }).session(session);

  if (!evidence) {
    throw createHttpError(
      "Financial verification evidence is missing.",
      409,
      "FINANCIAL_EVIDENCE_MISSING",
    );
  }

  if (
    !sameId(evidence.paymentTransactionId, payment._id) ||
    evidence.amountKes !== payment.amountKes ||
    evidence.checkoutRequestId !== payment.checkoutRequestId ||
    evidence.merchantRequestId !== payment.merchantRequestId ||
    evidence.mpesaReceiptNumber !== payment.mpesaReceiptNumber
  ) {
    throw createHttpError(
      "Financial verification evidence does not match the payment.",
      409,
      "FINANCIAL_EVIDENCE_MISMATCH",
    );
  }

  return payment;
}

async function settleSubscription(payment, session) {
  if (!payment.subscriptionId) {
    throw createHttpError(
      "The payment has no associated subscription reservation.",
      409,
      "SUBSCRIPTION_REFERENCE_MISSING",
    );
  }

  const subscription = await CreatorSubscription.findById(
    payment.subscriptionId,
  ).session(session);

  if (!subscription) {
    throw createHttpError(
      "Subscription reservation was not found.",
      404,
      "SUBSCRIPTION_NOT_FOUND",
    );
  }

  if (
    !sameId(subscription.fanId, payment.fanId) ||
    !sameId(subscription.creatorId, payment.creatorId) ||
    subscription.amountKes !== payment.amountKes ||
    subscription.currency !== payment.currency
  ) {
    throw createHttpError(
      "Subscription reservation does not match the verified payment.",
      409,
      "SUBSCRIPTION_PAYMENT_MISMATCH",
    );
  }

  if (!sameId(subscription.lastPaymentId, payment._id)) {
    throw createHttpError(
      "The subscription is not linked to this payment.",
      409,
      "SUBSCRIPTION_PAYMENT_LINK_MISMATCH",
    );
  }

  // Idempotent replay: never extend an already activated subscription.
  if (subscription.status === "ACTIVE") {
    if (!sameId(subscription.lastPaymentId, payment._id)) {
      throw createHttpError(
        "An active subscription is linked to a different payment.",
        409,
        "SUBSCRIPTION_ALREADY_ACTIVE",
      );
    }

    return {
      settled: true,
      duplicate: true,
      purpose: PAYMENT_PURPOSES.SUBSCRIPTION_INITIAL,
      subscriptionId: String(subscription._id),
      status: subscription.status,
      expiresAt: subscription.expiresAt,
    };
  }

  if (subscription.status !== "PENDING") {
    throw createHttpError(
      "The subscription reservation is no longer pending.",
      409,
      "SUBSCRIPTION_NOT_PENDING",
    );
  }

  const startedAt = new Date();
  const expiresAt = addOneCalendarMonth(startedAt);

  const updated = await CreatorSubscription.findOneAndUpdate(
    {
      _id: subscription._id,
      status: "PENDING",
      lastPaymentId: payment._id,
    },
    {
      $set: {
        status: "ACTIVE",
        startedAt,
        expiresAt,
      },
    },
    {
      new: true,
      session,
      runValidators: true,
    },
  );

  if (!updated) {
    throw createHttpError(
      "Unable to activate the subscription reservation.",
      409,
      "SUBSCRIPTION_ACTIVATION_CONFLICT",
    );
  }

  return {
    settled: true,
    duplicate: false,
    purpose: PAYMENT_PURPOSES.SUBSCRIPTION_INITIAL,
    subscriptionId: String(updated._id),
    status: updated.status,
    startedAt: updated.startedAt,
    expiresAt: updated.expiresAt,
  };
}

async function settleMediaPurchase(payment, session) {
  if (!payment.mediaPurchaseId) {
    throw createHttpError(
      "The payment has no associated media purchase reservation.",
      409,
      "MEDIA_PURCHASE_REFERENCE_MISSING",
    );
  }

  const purchase = await MediaPurchase.findById(
    payment.mediaPurchaseId,
  ).session(session);

  if (!purchase) {
    throw createHttpError(
      "Media purchase reservation was not found.",
      404,
      "MEDIA_PURCHASE_NOT_FOUND",
    );
  }

  if (
    !sameId(purchase.fanId, payment.fanId) ||
    !sameId(purchase.creatorId, payment.creatorId) ||
    purchase.amountKes !== payment.amountKes ||
    purchase.currency !== payment.currency
  ) {
    throw createHttpError(
      "Media purchase reservation does not match the verified payment.",
      409,
      "MEDIA_PURCHASE_PAYMENT_MISMATCH",
    );
  }

  if (!sameId(purchase.lastPaymentId, payment._id)) {
    throw createHttpError(
      "The media purchase is not linked to this payment.",
      409,
      "MEDIA_PURCHASE_PAYMENT_LINK_MISMATCH",
    );
  }

  // Idempotent replay: never create a second purchase entitlement.
  if (purchase.status === "ACTIVE") {
    return {
      settled: true,
      duplicate: true,
      purpose: PAYMENT_PURPOSES.MEDIA_PURCHASE,
      mediaPurchaseId: String(purchase._id),
      mediaId: String(purchase.mediaId),
      status: purchase.status,
    };
  }

  if (purchase.status !== "PENDING") {
    throw createHttpError(
      "The media purchase reservation is no longer pending.",
      409,
      "MEDIA_PURCHASE_NOT_PENDING",
    );
  }

  const updated = await MediaPurchase.findOneAndUpdate(
    {
      _id: purchase._id,
      status: "PENDING",
      lastPaymentId: payment._id,
    },
    {
      $set: {
        status: "ACTIVE",
        purchasedAt: new Date(),
      },
    },
    {
      new: true,
      session,
      runValidators: true,
    },
  );

  if (!updated) {
    throw createHttpError(
      "Unable to activate the media purchase.",
      409,
      "MEDIA_PURCHASE_ACTIVATION_CONFLICT",
    );
  }

  return {
    settled: true,
    duplicate: false,
    purpose: PAYMENT_PURPOSES.MEDIA_PURCHASE,
    mediaPurchaseId: String(updated._id),
    mediaId: String(updated.mediaId),
    status: updated.status,
  };
}

export async function settleVerifiedPayment({ paymentId }) {
  if (!mongoose.isValidObjectId(paymentId)) {
    throw createHttpError(
      "A valid payment ID is required.",
    );
  }

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const payment = await validateVerifiedPayment(
        paymentId,
        session,
      );

      if (
        payment.purpose === PAYMENT_PURPOSES.SUBSCRIPTION_INITIAL
      ) {
        result = await settleSubscription(payment, session);
        return;
      }

      if (payment.purpose === PAYMENT_PURPOSES.MEDIA_PURCHASE) {
        result = await settleMediaPurchase(payment, session);
        return;
      }

      throw createHttpError(
        "This payment purpose is not supported by the settlement service.",
        400,
        "UNSUPPORTED_PAYMENT_PURPOSE",
      );
    });

    return {
      ...result,
      paymentId: String(paymentId),
      paymentStatus: PAYMENT_STATUSES.SUCCEEDED,
      accessGranted: true,
    };
  } finally {
    await session.endSession();
  }
}
