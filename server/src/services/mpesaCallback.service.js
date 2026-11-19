
import MpesaCallbackEvent, {
  MPESA_CALLBACK_STATUSES,
} from "../models/MpesaCallbackEvent.model.js";

import PaymentTransaction from "../models/PaymentTransaction.model.js";

function createHttpError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function getMetadataValue(items, name) {
  if (!Array.isArray(items)) {
    return null;
  }

  const item = items.find(
    (entry) =>
      typeof entry?.Name === "string" &&
      entry.Name.toLowerCase() === name.toLowerCase(),
  );

  return item?.Value ?? null;
}

function normalizeCallbackPayload(payload) {
  const callback = payload?.Body?.stkCallback;

  if (!callback || typeof callback !== "object") {
    throw createHttpError(
      "Invalid M-Pesa STK callback payload.",
      400,
      "INVALID_MPESA_CALLBACK",
    );
  }

  const checkoutRequestId =
    typeof callback.CheckoutRequestID === "string"
      ? callback.CheckoutRequestID.trim()
      : "";

  const merchantRequestId =
    typeof callback.MerchantRequestID === "string"
      ? callback.MerchantRequestID.trim()
      : "";

  const resultCode = Number(callback.ResultCode);

  if (
    !checkoutRequestId ||
    !merchantRequestId ||
    !Number.isInteger(resultCode)
  ) {
    throw createHttpError(
      "M-Pesa callback is missing required transaction identifiers.",
      400,
      "INVALID_MPESA_CALLBACK",
    );
  }

  const metadata = callback.CallbackMetadata?.Item;

  const rawAmount = getMetadataValue(metadata, "Amount");
  const rawPhoneNumber = getMetadataValue(metadata, "PhoneNumber");

  const amountKes =
    rawAmount !== null && rawAmount !== undefined
      ? Number(rawAmount)
      : null;

  if (
    amountKes !== null &&
    (!Number.isFinite(amountKes) || amountKes < 0)
  ) {
    throw createHttpError(
      "M-Pesa callback contains an invalid amount.",
      400,
      "INVALID_MPESA_CALLBACK_AMOUNT",
    );
  }

  return {
    checkoutRequestId,
    merchantRequestId,
    resultCode,
    resultDescription:
      typeof callback.ResultDesc === "string"
        ? callback.ResultDesc.slice(0, 1000)
        : null,
    amountKes,
    mpesaReceiptNumber:
      getMetadataValue(metadata, "MpesaReceiptNumber") !== null
        ? String(getMetadataValue(metadata, "MpesaReceiptNumber"))
        : null,
    transactionDate:
      getMetadataValue(metadata, "TransactionDate") !== null
        ? String(getMetadataValue(metadata, "TransactionDate"))
        : null,
    phoneNumber:
      rawPhoneNumber !== null ? String(rawPhoneNumber) : null,
  };
}

export async function ingestMpesaStkCallback(payload) {
  if (!payload || typeof payload !== "object") {
    throw createHttpError(
      "M-Pesa callback payload is required.",
      400,
      "INVALID_MPESA_CALLBACK",
    );
  }

  const callback = normalizeCallbackPayload(payload);

  const existingEvent = await MpesaCallbackEvent.findOne({
    checkoutRequestId: callback.checkoutRequestId,
  }).select("_id status paymentTransactionId");

  if (existingEvent) {
    return {
      accepted: true,
      duplicate: true,
      eventId: existingEvent._id,
      status: existingEvent.status,
      paymentMatched: Boolean(existingEvent.paymentTransactionId),
    };
  }

  const payment = await PaymentTransaction.findOne({
    checkoutRequestId: callback.checkoutRequestId,
  }).select("_id checkoutRequestId");

  const eventStatus = payment
    ? MPESA_CALLBACK_STATUSES.RECEIVED
    : MPESA_CALLBACK_STATUSES.UNMATCHED;

  try {
    const event = await MpesaCallbackEvent.create({
      ...callback,
      callbackPayload: payload,
      paymentTransactionId: payment?._id ?? null,
      status: eventStatus,
    });

    return {
      accepted: true,
      duplicate: false,
      eventId: event._id,
      status: event.status,
      paymentMatched: Boolean(payment),
    };
  } catch (error) {
    // A concurrent duplicate callback may win the unique index race.
    if (error?.code === 11000) {
      const duplicateEvent = await MpesaCallbackEvent.findOne({
        checkoutRequestId: callback.checkoutRequestId,
      }).select("_id status paymentTransactionId");

      if (duplicateEvent) {
        return {
          accepted: true,
          duplicate: true,
          eventId: duplicateEvent._id,
          status: duplicateEvent.status,
          paymentMatched: Boolean(duplicateEvent.paymentTransactionId),
        };
      }
    }

    throw error;
  }
}
