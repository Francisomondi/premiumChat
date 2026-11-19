import { env } from "../config/env.js";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

import PaymentTransaction, {
  PAYMENT_STATUSES,
} from "../models/PaymentTransaction.model.js";

import MpesaCallbackEvent, {
  MPESA_CALLBACK_STATUSES,
} from "../models/MpesaCallbackEvent.model.js";

import MpesaFinancialVerification, {
  MPESA_EVIDENCE_SOURCES,
} from "../models/MpesaFinancialVerification.model.js";

import {
  queryDarajaStkStatus,
} from "./mpesaDaraja.service.js";

const CALLBACK_PROCESSING_LEASE_MS = Math.max(
  2 * 60 * 1000,
  env.MPESA_TIMEOUT_MS * 2 + 30 * 1000,
);

function createHttpError(
  message,
  status = 400,
  code = "PAYMENT_VERIFICATION_ERROR",
) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function normalizePhoneNumber(phoneNumber) {
  if (typeof phoneNumber !== "string") {
    return null;
  }

  let digits = phoneNumber.replace(/\D/g, "");

  if (digits.startsWith("0")) {
    digits = `254${digits.slice(1)}`;
  } else if (digits.startsWith("7") || digits.startsWith("1")) {
    digits = `254${digits}`;
  }

  return /^254[71]\d{8}$/.test(digits) ? digits : null;
}

function sameId(first, second) {
  return Boolean(first && second && String(first) === String(second));
}

function sameValue(first, second) {
  return String(first ?? "").trim() === String(second ?? "").trim();
}

function normalizeReceipt(receipt) {
  if (typeof receipt !== "string") {
    return null;
  }

  const normalized = receipt.trim().toUpperCase();

  return /^[A-Z0-9]{8,20}$/.test(normalized)
    ? normalized
    : null;
}

async function markManualReview({
  callbackEventId,
  paymentId,
  leaseOwner,
  reason,
}) {
  const session = await mongoose.startSession();

  try {
    let updated = false;

    await session.withTransaction(async () => {
      const callback = await MpesaCallbackEvent.findOneAndUpdate(
        {
          _id: callbackEventId,
          status: MPESA_CALLBACK_STATUSES.PROCESSING,
          processingLeaseOwner: leaseOwner,
            processingLeaseExpiresAt: { $gt: new Date() },
        },
        {
          $set: {
            status: MPESA_CALLBACK_STATUSES.MANUAL_REVIEW,
            lastError: reason,
            processedAt: new Date(),
            processingLeaseOwner: null,
            processingLeaseExpiresAt: null,
          },
        },
        {
          new: true,
          session,
        },
      );

      if (!callback) {
        return;
      }

      updated = true;

      if (paymentId) {
        const payment = await PaymentTransaction.findById(paymentId)
          .session(session);

        if (
          payment &&
          payment.status !== PAYMENT_STATUSES.SUCCEEDED
        ) {
          payment.status = PAYMENT_STATUSES.REQUIRES_RECONCILIATION;
          payment.reconciliationRequiredAt =
            payment.reconciliationRequiredAt || new Date();

          await payment.save({ session });
        }
      }
    });

    return updated;
  } finally {
    await session.endSession();
  }
}

async function releaseForRetry({
  callbackEventId,
  leaseOwner,
  reason,
}) {
  const result = await MpesaCallbackEvent.findOneAndUpdate(
    {
    _id: callbackEventId,
    status: MPESA_CALLBACK_STATUSES.PROCESSING,
    processingLeaseOwner: leaseOwner,
    processingLeaseExpiresAt: { $gt: new Date() },
    },
    {
      $set: {
        status: MPESA_CALLBACK_STATUSES.RECEIVED,
        lastError: reason,
        processingLeaseOwner: null,
        processingLeaseExpiresAt: null,
      },
    },
    {
      new: true,
    },
  );

  return Boolean(result);
}

async function claimCallbackEvent(callbackEventId) {
  if (!mongoose.isValidObjectId(callbackEventId)) {
    throw createHttpError(
      "A valid callback event ID is required.",
    );
  }

  const leaseOwner = randomUUID();
  const now = new Date();

  const callback = await MpesaCallbackEvent.findOneAndUpdate(
    {
      _id: callbackEventId,
      status: MPESA_CALLBACK_STATUSES.RECEIVED,
    },
    {
      $set: {
        status: MPESA_CALLBACK_STATUSES.PROCESSING,
        lastError: null,
        processingLeaseOwner: leaseOwner,
        processingLeaseExpiresAt: new Date(
          now.getTime() + CALLBACK_PROCESSING_LEASE_MS,
        ),
      },
      $inc: {
        processingAttempts: 1,
      },
    },
    {
      new: true,
    },
  );

  return callback
    ? { callback, leaseOwner }
    : null;
}

function validatePaymentAndCallback(payment, callback) {
  if (!payment) {
    throw createHttpError(
      "The payment transaction could not be found.",
      404,
      "PAYMENT_NOT_FOUND",
    );
  }

  if (
    !callback.paymentTransactionId ||
    !sameId(callback.paymentTransactionId, payment._id)
  ) {
    throw createHttpError(
      "The callback is not linked to the expected payment.",
      409,
      "CALLBACK_PAYMENT_MISMATCH",
    );
  }

  if (!payment.checkoutRequestId || !payment.merchantRequestId) {
    throw createHttpError(
      "The payment does not have complete Daraja request identifiers.",
      409,
      "PAYMENT_IDENTIFIERS_MISSING",
    );
  }

  if (
    !sameValue(callback.checkoutRequestId, payment.checkoutRequestId) ||
    !sameValue(callback.merchantRequestId, payment.merchantRequestId)
  ) {
    throw createHttpError(
      "The callback request identifiers do not match the payment.",
      409,
      "CALLBACK_IDENTIFIERS_MISMATCH",
    );
  }

  if (Number(callback.resultCode) !== 0) {
    throw createHttpError(
      "The callback does not report a successful STK transaction.",
      409,
      "CALLBACK_NOT_SUCCESSFUL",
    );
  }

  if (
    !Number.isSafeInteger(callback.amountKes) ||
    callback.amountKes !== payment.amountKes
  ) {
    throw createHttpError(
      "The callback amount does not match the reserved payment amount.",
      409,
      "PAYMENT_AMOUNT_MISMATCH",
    );
  }

  const callbackPhone = normalizePhoneNumber(callback.phoneNumber);
  const paymentPhone = normalizePhoneNumber(payment.phoneNumber);

  if (!callbackPhone || !paymentPhone || callbackPhone !== paymentPhone) {
    throw createHttpError(
      "The callback phone number does not match the payment phone number.",
      409,
      "PAYMENT_PHONE_MISMATCH",
    );
  }

  const receipt = normalizeReceipt(callback.mpesaReceiptNumber);

  if (!receipt) {
    throw createHttpError(
      "The callback does not contain a valid M-Pesa receipt number.",
      409,
      "MPESA_RECEIPT_MISSING",
    );
  }

  return {
    receipt,
    phoneNumber: callbackPhone,
  };
}

function validateDarajaQuery(query, payment, callback) {
  if (!query || String(query.responseCode) !== "0") {
    throw createHttpError(
      query?.responseDescription ||
        "Daraja did not accept the STK Query request.",
      503,
      "STK_QUERY_UNAVAILABLE",
    );
  }

  if (
    !sameValue(query.checkoutRequestId, payment.checkoutRequestId) ||
    !sameValue(query.merchantRequestId, payment.merchantRequestId)
  ) {
    throw createHttpError(
      "The STK Query identifiers do not match the original payment.",
      409,
      "STK_QUERY_IDENTIFIERS_MISMATCH",
    );
  }

  if (query.resultCode === null || query.resultCode === undefined) {
    throw createHttpError(
      "The STK transaction is not yet complete.",
      503,
      "STK_QUERY_PENDING",
    );
  }

  if (Number(query.resultCode) !== 0) {
    throw createHttpError(
      query.resultDescription ||
        "Daraja reports that the STK transaction was not successful.",
      409,
      "STK_TRANSACTION_NOT_SUCCESSFUL",
    );
  }

  if (Number(callback.resultCode) !== Number(query.resultCode)) {
    throw createHttpError(
      "The callback result does not agree with the STK Query result.",
      409,
      "STK_RESULT_MISMATCH",
    );
  }
}

async function recordVerifiedPayment({
  paymentId,
  callbackEventId,
  leaseOwner,
  evidence,
}) {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const callback = await MpesaCallbackEvent.findOne({
        _id: callbackEventId,
        status: MPESA_CALLBACK_STATUSES.PROCESSING,
        processingLeaseOwner: leaseOwner,
        processingLeaseExpiresAt: { $gt: new Date() },
      }).session(session);

      if (!callback) {
        throw createHttpError(
          "The callback processing lease has expired or is no longer owned by this worker.",
          409,
          "CALLBACK_LEASE_LOST",
        );
      }

      const existingEvidence =
        await MpesaFinancialVerification.findOne({
          paymentTransactionId: paymentId,
        }).session(session);

      if (existingEvidence) {
        if (
          !sameId(existingEvidence.callbackEventId, callbackEventId) ||
          !sameValue(
            existingEvidence.mpesaReceiptNumber,
            evidence.mpesaReceiptNumber,
          )
        ) {
          throw createHttpError(
            "Conflicting financial verification evidence already exists.",
            409,
            "FINANCIAL_EVIDENCE_CONFLICT",
          );
        }

        callback.status = MPESA_CALLBACK_STATUSES.RECONCILED;
        callback.processedAt = new Date();
        callback.lastError = null;
        callback.processingLeaseOwner = null;
        callback.processingLeaseExpiresAt = null;

        await callback.save({ session });

        result = {
          verified: true,
          duplicate: true,
          paymentId: String(paymentId),
          evidenceId: String(existingEvidence._id),
        };

        return;
      }

      const payment = await PaymentTransaction.findById(paymentId)
        .session(session);

      if (!payment) {
        throw createHttpError(
          "The payment or callback event no longer exists.",
          404,
          "VERIFICATION_RECORD_NOT_FOUND",
        );
      }

      if (payment.status === PAYMENT_STATUSES.SUCCEEDED) {
        throw createHttpError(
          "The payment is already marked successful but has no matching evidence.",
          409,
          "PAYMENT_EVIDENCE_INCONSISTENCY",
        );
      }

      if (
        payment.status !== PAYMENT_STATUSES.PROCESSING &&
        payment.status !== PAYMENT_STATUSES.UNKNOWN &&
        payment.status !== PAYMENT_STATUSES.REQUIRES_RECONCILIATION
      ) {
        throw createHttpError(
          "The payment is not in a verifiable state.",
          409,
          "PAYMENT_NOT_VERIFIABLE",
        );
      }

      if (!sameId(callback.paymentTransactionId, payment._id)) {
        throw createHttpError(
          "The callback event is no longer linked to this payment.",
          409,
          "CALLBACK_NOT_PROCESSING",
        );
      }

      const verifiedAt = new Date();

      await MpesaFinancialVerification.create(
        [{
          paymentTransactionId: payment._id,
          callbackEventId: callback._id,
          evidenceSource: MPESA_EVIDENCE_SOURCES.DARAJA_STK_QUERY,
          merchantRequestId: evidence.merchantRequestId,
          checkoutRequestId: evidence.checkoutRequestId,
          resultCode: "0",
          resultDescription: evidence.resultDescription || null,
          amountKes: evidence.amountKes,
          mpesaReceiptNumber: evidence.mpesaReceiptNumber,
          phoneNumber: evidence.phoneNumber,
          verifiedAt,
        }],
        { session },
      );

      payment.status = PAYMENT_STATUSES.SUCCEEDED;
      payment.mpesaReceiptNumber = evidence.mpesaReceiptNumber;
      payment.resultCode = "0";
      payment.resultDescription =
        evidence.resultDescription || "STK transaction verified.";
      payment.verifiedAt = verifiedAt;
      payment.failedAt = null;
      payment.reconciliationRequiredAt = null;

      await payment.save({ session });

      callback.status = MPESA_CALLBACK_STATUSES.RECONCILED;
      callback.processedAt = verifiedAt;
      callback.lastError = null;
      callback.processingLeaseOwner = null;
      callback.processingLeaseExpiresAt = null;

      await callback.save({ session });

      result = {
        verified: true,
        duplicate: false,
        paymentId: String(payment._id),
        evidenceId: null,
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
}

export async function verifyMpesaCallbackEvent({
  callbackEventId,
}) {
  const claimed = await claimCallbackEvent(callbackEventId);

  if (!claimed) {
    const existing = await MpesaCallbackEvent.findById(callbackEventId);

    if (
      existing?.status === MPESA_CALLBACK_STATUSES.RECONCILED
    ) {
      const evidence = await MpesaFinancialVerification.findOne({
        callbackEventId: existing._id,
      });

      return {
        verified: true,
        duplicate: true,
        paymentId: existing.paymentTransactionId
          ? String(existing.paymentTransactionId)
          : null,
        evidenceId: evidence ? String(evidence._id) : null,
      };
    }

    if (
      existing?.status === MPESA_CALLBACK_STATUSES.MANUAL_REVIEW
    ) {
      return {
        verified: false,
        manualReview: true,
        reason: existing.lastError,
      };
    }

    throw createHttpError(
      "The callback event is missing or is already being processed.",
      409,
      "CALLBACK_NOT_AVAILABLE",
    );
  }

  const { callback, leaseOwner } = claimed;

  try {
    if (!callback.paymentTransactionId) {
      throw createHttpError(
        "The callback has not yet been matched to a payment transaction.",
        409,
        "CALLBACK_UNMATCHED",
      );
    }

    const payment = await PaymentTransaction.findById(
      callback.paymentTransactionId,
    ).select("+phoneNumber");

    validatePaymentAndCallback(payment, callback);

    const query = await queryDarajaStkStatus({
      checkoutRequestId: payment.checkoutRequestId,
    });

    validateDarajaQuery(query, payment, callback);

    const validated = validatePaymentAndCallback(payment, callback);

    const result = await recordVerifiedPayment({
      paymentId: payment._id,
      callbackEventId: callback._id,
      leaseOwner,
      evidence: {
        merchantRequestId: payment.merchantRequestId,
        checkoutRequestId: payment.checkoutRequestId,
        resultDescription:
          query.resultDescription || callback.resultDescription,
        amountKes: callback.amountKes,
        mpesaReceiptNumber: validated.receipt,
        phoneNumber: validated.phoneNumber,
      },
    });

    const evidence = await MpesaFinancialVerification.findOne({
      paymentTransactionId: payment._id,
    });

    return {
      ...result,
      evidenceId: evidence ? String(evidence._id) : result.evidenceId,
      paymentStatus: PAYMENT_STATUSES.SUCCEEDED,
      accessGranted: false,
    };
  } catch (error) {
    const retryable =
      error.code === "STK_QUERY_UNAVAILABLE" ||
      error.code === "STK_QUERY_PENDING";

    if (retryable) {
      const released = await releaseForRetry({
        callbackEventId: callback._id,
        leaseOwner,
        reason: error.message,
      });

      return {
        verified: false,
        retryable: true,
        leaseLost: !released,
        reason: error.message,
      };
    }

    const movedToManualReview = await markManualReview({
      callbackEventId: callback._id,
      paymentId: callback.paymentTransactionId,
      leaseOwner,
      reason: error.message,
    });

    if (!movedToManualReview) {
      return {
        verified: false,
        retryable: true,
        leaseLost: true,
        reason: error.message,
      };
    }

    return {
      verified: false,
      manualReview: true,
      reason: error.message,
    };
  }
}
