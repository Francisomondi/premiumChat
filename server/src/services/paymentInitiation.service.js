
import crypto from "node:crypto";

import CreatorSubscription from "../models/CreatorSubscription.model.js";
import MediaPurchase from "../models/MediaPurchase.model.js";
import PaymentTransaction, {
  PAYMENT_PURPOSES,
  PAYMENT_STATUSES,
} from "../models/PaymentTransaction.model.js";

import { env } from "../config/env.js";
import {
  initiateDarajaStkPush,
} from "./mpesaDaraja.service.js";

const INITIATION_STATUS = Object.freeze({
  NOT_STARTED: "NOT_STARTED",
  DISPATCHING: "DISPATCHING",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  UNKNOWN: "UNKNOWN",
});

function createHttpError(message, status = 400, code = "PAYMENT_ERROR") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function normalizePhoneNumber(phoneNumber) {
  if (typeof phoneNumber !== "string") {
    throw createHttpError("A valid M-Pesa phone number is required.");
  }

  let digits = phoneNumber.replace(/\D/g, "");

  if (digits.startsWith("0")) {
    digits = `254${digits.slice(1)}`;
  } else if (digits.startsWith("7") || digits.startsWith("1")) {
    digits = `254${digits}`;
  }

  if (!/^254[71]\d{8}$/.test(digits)) {
    throw createHttpError("Enter a valid Kenyan M-Pesa phone number.");
  }

  return digits;
}

function createPhoneFingerprint(phoneNumber) {
  return crypto
    .createHmac("sha256", env.JWT_ACCESS_SECRET)
    .update(phoneNumber)
    .digest("hex");
}

function createPaymentReference() {
  return `PC${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
}

function sameId(first, second) {
  return Boolean(first && second && String(first) === String(second));
}

function formatPaymentResult(payment, customerMessage = null) {
  return {
    paymentId: String(payment._id),
    paymentReference: payment.paymentReference,
    purpose: payment.purpose,
    amountKes: payment.amountKes,
    currency: payment.currency,
    status: payment.status,
    initiationStatus: payment.initiationStatus,
    checkoutRequestId: payment.checkoutRequestId || null,
    customerMessage,
    paymentVerified: false,
    accessGranted: false,
  };
}

async function findExistingPayment(fanId, clientRequestId) {
  return PaymentTransaction.findOne({
    fanId,
    clientRequestId,
  }).select("+phoneNumber +phoneFingerprint");
}

async function getReservation({
  Model,
  reservationId,
  fanId,
  reservationLabel,
}) {
  if (!reservationId || !/^[a-f\d]{24}$/i.test(String(reservationId))) {
    throw createHttpError(`A valid ${reservationLabel} ID is required.`);
  }

  const reservation = await Model.findOne({
    _id: reservationId,
    fanId,
  });

  if (!reservation) {
    throw createHttpError(
      `${reservationLabel} reservation was not found.`,
      404,
      "RESERVATION_NOT_FOUND",
    );
  }

  if (reservation.status !== "PENDING") {
    throw createHttpError(
      `This ${reservationLabel.toLowerCase()} reservation is not awaiting payment.`,
      409,
      "RESERVATION_NOT_PAYABLE",
    );
  }

  return reservation;
}

async function linkPaymentToReservation({
  Model,
  reservation,
  payment,
  reservationLabel,
}) {
  if (
    reservation.lastPaymentId &&
    !sameId(reservation.lastPaymentId, payment._id)
  ) {
    throw createHttpError(
      `A different payment is already linked to this ${reservationLabel.toLowerCase()} reservation.`,
      409,
      "RESERVATION_PAYMENT_CONFLICT",
    );
  }

  if (sameId(reservation.lastPaymentId, payment._id)) {
    return;
  }

  const updated = await Model.findOneAndUpdate(
    {
      _id: reservation._id,
      fanId: reservation.fanId,
      status: "PENDING",
      $or: [
        { lastPaymentId: null },
        { lastPaymentId: { $exists: false } },
      ],
    },
    {
      $set: {
        lastPaymentId: payment._id,
      },
    },
    {
      new: true,
    },
  );

  if (!updated) {
    const latest = await Model.findById(reservation._id);

    if (!sameId(latest?.lastPaymentId, payment._id)) {
      throw createHttpError(
        `Unable to link payment to the ${reservationLabel.toLowerCase()} reservation.`,
        409,
        "RESERVATION_PAYMENT_LINK_FAILED",
      );
    }
  }
}

async function createOrReusePayment({
  reservation,
  fan,
  purpose,
  reservationModel,
  reservationLabel,
  phoneNumber,
}) {
  const fanId = fan._id;
  const clientRequestId = reservation.clientRequestId;
  const phoneFingerprint = createPhoneFingerprint(phoneNumber);

  let payment = await findExistingPayment(fanId, clientRequestId);

  if (payment) {
    const expectedReservationId =
      purpose === PAYMENT_PURPOSES.SUBSCRIPTION_INITIAL
        ? payment.subscriptionId
        : payment.mediaPurchaseId;

    if (!sameId(expectedReservationId, reservation._id)) {
      throw createHttpError(
        "This request ID is already associated with a different payment.",
        409,
        "PAYMENT_IDEMPOTENCY_CONFLICT",
      );
    }

    if (payment.phoneFingerprint !== phoneFingerprint) {
      throw createHttpError(
        "This payment was already initiated with a different phone number. Do not create another payment request.",
        409,
        "PAYMENT_PHONE_CONFLICT",
      );
    }
  } else {
    try {
      const paymentData = {
        paymentReference: createPaymentReference(),
        clientRequestId,
        fanId,
        creatorId: reservation.creatorId,
        subscriptionId:
          purpose === PAYMENT_PURPOSES.SUBSCRIPTION_INITIAL
            ? reservation._id
            : null,
        mediaPurchaseId:
          purpose === PAYMENT_PURPOSES.MEDIA_PURCHASE
            ? reservation._id
            : null,
        purpose,
        amountKes: reservation.amountKes,
        currency: reservation.currency || "KES",
        phoneNumber,
        phoneFingerprint,
        status: PAYMENT_STATUSES.PENDING,
        initiationStatus: INITIATION_STATUS.NOT_STARTED,
      };

      [payment] = await PaymentTransaction.create([paymentData]);
    } catch (error) {
      if (error.code !== 11000) {
        throw error;
      }

      payment = await findExistingPayment(fanId, clientRequestId);

      if (!payment) {
        throw createHttpError(
          "Unable to safely retrieve the existing payment request. Please try again.",
          409,
          "PAYMENT_CREATION_CONFLICT",
        );
      }

      if (
        !payment.phoneFingerprint ||
        payment.phoneFingerprint !== phoneFingerprint
      ) {
        throw createHttpError(
          "This payment request already exists with different payment details.",
          409,
          "PAYMENT_IDEMPOTENCY_CONFLICT",
        );
      }
    }
  }

  await linkPaymentToReservation({
    Model: reservationModel,
    reservation,
    payment,
    reservationLabel,
  });

  return payment;
}

async function dispatchPayment(payment) {
  // Only one concurrent request can claim this payment for dispatch.
  const claimedPayment = await PaymentTransaction.findOneAndUpdate(
    {
      _id: payment._id,
      status: PAYMENT_STATUSES.PENDING,
      initiationStatus: INITIATION_STATUS.NOT_STARTED,
    },
    {
      $set: {
        status: PAYMENT_STATUSES.INITIATING,
        initiationStatus: INITIATION_STATUS.DISPATCHING,
      },
      $inc: {
        initiationAttempts: 1,
      },
    },
    {
      new: true,
    },
  ).select("+phoneNumber +phoneFingerprint");

  if (!claimedPayment) {
    const latestPayment = await PaymentTransaction.findById(
      payment._id,
    );

    // Another request already dispatched, is dispatching, or needs
    // reconciliation. Never send a second STK Push automatically.
    return formatPaymentResult(latestPayment || payment);
  }

  try {
    const result = await initiateDarajaStkPush({
      phoneNumber: claimedPayment.phoneNumber,
      amountKes: claimedPayment.amountKes,
      paymentReference: claimedPayment.paymentReference,
    });

    const updatedPayment = await PaymentTransaction.findOneAndUpdate(
      {
        _id: claimedPayment._id,
        initiationStatus: INITIATION_STATUS.DISPATCHING,
      },
      {
        $set: {
          status: PAYMENT_STATUSES.PROCESSING,
          initiationStatus: INITIATION_STATUS.ACCEPTED,
          merchantRequestId: result.merchantRequestId,
          checkoutRequestId: result.checkoutRequestId,
          providerResponseCode: result.responseCode,
          resultDescription: result.responseDescription || null,
          initiatedAt: new Date(),
        },
      },
      {
        new: true,
      },
    );

    return formatPaymentResult(
      updatedPayment || claimedPayment,
      result.customerMessage,
    );
  } catch (error) {
    const outcomeUnknown = error.outcomeUnknown === true;

    const updatedPayment = await PaymentTransaction.findOneAndUpdate(
      {
        _id: claimedPayment._id,
        initiationStatus: INITIATION_STATUS.DISPATCHING,
      },
      {
        $set: {
          status: outcomeUnknown
            ? PAYMENT_STATUSES.UNKNOWN
            : PAYMENT_STATUSES.FAILED,
          initiationStatus: outcomeUnknown
            ? INITIATION_STATUS.UNKNOWN
            : INITIATION_STATUS.REJECTED,
          resultDescription: error.message || "STK Push initiation failed.",
          providerResponseCode: error.providerResponseCode || null,
          failedAt: outcomeUnknown ? null : new Date(),
          reconciliationRequiredAt: outcomeUnknown
            ? new Date()
            : null,
        },
      },
      {
        new: true,
      },
    );

    if (outcomeUnknown) {
      return {
        ...formatPaymentResult(updatedPayment || claimedPayment),
        message:
          "The STK Push outcome is uncertain. Do not retry the payment. It requires reconciliation.",
        reconciliationRequired: true,
      };
    }

    throw createHttpError(
      error.message || "Unable to initiate the M-Pesa payment.",
      error.status || 502,
      "MPESA_INITIATION_FAILED",
    );
  }
}

async function initiateReservedPayment({
  fan,
  reservationId,
  phoneNumber,
  ReservationModel,
  purpose,
  reservationLabel,
}) {
  if (!fan?._id || fan.role !== "FAN" || fan.status !== "ACTIVE") {
    throw createHttpError(
      "An active fan account is required to make this payment.",
      403,
      "FAN_ACCOUNT_REQUIRED",
    );
  }

  if (!fan.ageVerifiedAt) {
    throw createHttpError(
      "Age verification is required before making payments.",
      403,
      "AGE_VERIFICATION_REQUIRED",
    );
  }

  const normalizedPhone = normalizePhoneNumber(phoneNumber);

  const reservation = await getReservation({
    Model: ReservationModel,
    reservationId,
    fanId: fan._id,
    reservationLabel,
  });

  const payment = await createOrReusePayment({
    reservation,
    fan,
    purpose,
    reservationModel: ReservationModel,
    reservationLabel,
    phoneNumber: normalizedPhone,
  });

  return dispatchPayment(payment);
}

export async function initiateSubscriptionPayment({
  fan,
  subscriptionId,
  phoneNumber,
}) {
  return initiateReservedPayment({
    fan,
    reservationId: subscriptionId,
    phoneNumber,
    ReservationModel: CreatorSubscription,
    purpose: PAYMENT_PURPOSES.SUBSCRIPTION_INITIAL,
    reservationLabel: "Subscription",
  });
}

export async function initiateMediaPurchasePayment({
  fan,
  mediaPurchaseId,
  phoneNumber,
}) {
  return initiateReservedPayment({
    fan,
    reservationId: mediaPurchaseId,
    phoneNumber,
    ReservationModel: MediaPurchase,
    purpose: PAYMENT_PURPOSES.MEDIA_PURCHASE,
    reservationLabel: "Media purchase",
  });
}
