
import axios from "axios";

import { env } from "../config/env.js";

const BASE_URL =
  env.MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

const darajaClient = axios.create({
  baseURL: BASE_URL,
  timeout: env.MPESA_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

let cachedAccessToken = null;
let tokenExpiresAt = 0;

function requireDarajaCredentials() {
  if (
    !env.MPESA_CONSUMER_KEY ||
    !env.MPESA_CONSUMER_SECRET
  ) {
    throw new Error(
      "Daraja consumer credentials are not configured.",
    );
  }
}

function requireStkConfiguration() {
  requireDarajaCredentials();

  if (
    !env.MPESA_SHORTCODE ||
    !env.MPESA_PASSKEY ||
    !env.MPESA_CALLBACK_URL
  ) {
    throw new Error(
      "Daraja STK Push configuration is incomplete.",
    );
  }
}

function requireStkQueryConfiguration() {
  requireDarajaCredentials();

  if (!env.MPESA_SHORTCODE || !env.MPESA_PASSKEY) {
    throw new Error(
      "Daraja STK Query configuration is incomplete.",
    );
  }
}

function getNairobiTimestamp() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return (
    values.year +
    values.month +
    values.day +
    values.hour +
    values.minute +
    values.second
  );
}

function normalizeMpesaPhoneNumber(phoneNumber) {
  if (typeof phoneNumber !== "string") {
    throw new Error("A valid M-Pesa phone number is required.");
  }

  let digits = phoneNumber.replace(/\D/g, "");

  if (digits.startsWith("0")) {
    digits = `254${digits.slice(1)}`;
  } else if (digits.startsWith("7") || digits.startsWith("1")) {
    digits = `254${digits}`;
  }

  if (!/^254[71]\d{8}$/.test(digits)) {
    throw new Error(
      "Enter a valid Kenyan M-Pesa phone number.",
    );
  }

  return digits;
}

function createStkPassword({ shortcode, passkey, timestamp }) {
  return Buffer.from(
    `${shortcode}${passkey}${timestamp}`,
  ).toString("base64");
}

export async function getDarajaAccessToken() {
  requireDarajaCredentials();

  const now = Date.now();

  if (
    cachedAccessToken &&
    now < tokenExpiresAt - 60_000
  ) {
    return cachedAccessToken;
  }

  try {
    const credentials = Buffer.from(
      `${env.MPESA_CONSUMER_KEY}:${env.MPESA_CONSUMER_SECRET}`,
    ).toString("base64");

    const response = await darajaClient.get(
      "/oauth/v1/generate",
      {
        params: {
          grant_type: "client_credentials",
        },
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      },
    );

    const accessToken = response.data?.access_token;
    const expiresIn = Number(response.data?.expires_in);

    if (
      typeof accessToken !== "string" ||
      !accessToken ||
      !Number.isFinite(expiresIn) ||
      expiresIn <= 0
    ) {
      throw new Error(
        "Daraja returned an invalid OAuth response.",
      );
    }

    cachedAccessToken = accessToken;
    tokenExpiresAt = now + expiresIn * 1000;

    return cachedAccessToken;
  } catch (error) {
    cachedAccessToken = null;
    tokenExpiresAt = 0;

    const providerMessage =
      error.response?.data?.error_description ||
      error.response?.data?.errorMessage;

    const safeError = new Error(
      providerMessage
        ? `Daraja authentication failed: ${providerMessage}`
        : "Unable to authenticate with Daraja.",
    );

    safeError.status = 502;
    safeError.providerStatus = error.response?.status;

    throw safeError;
  }
}

export async function initiateDarajaStkPush({
  phoneNumber,
  amountKes,
  paymentReference,
}) {
  requireStkConfiguration();

  if (
    !Number.isSafeInteger(amountKes) ||
    amountKes < 1 ||
    amountKes > 100000
  ) {
    throw new Error("Invalid M-Pesa payment amount.");
  }

  if (
    typeof paymentReference !== "string" ||
    paymentReference.trim().length < 1 ||
    paymentReference.trim().length > 12
  ) {
    throw new Error("Invalid M-Pesa payment reference.");
  }

  const normalizedPhone =
    normalizeMpesaPhoneNumber(phoneNumber);

  const timestamp = getNairobiTimestamp();

  const password = createStkPassword({
    shortcode: env.MPESA_SHORTCODE,
    passkey: env.MPESA_PASSKEY,
    timestamp,
  });

  const accessToken = await getDarajaAccessToken();

  const payload = {
    BusinessShortCode: env.MPESA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: env.MPESA_TRANSACTION_TYPE,
    Amount: amountKes,
    PartyA: normalizedPhone,
    PartyB: env.MPESA_SHORTCODE,
    PhoneNumber: normalizedPhone,
    CallBackURL: env.MPESA_CALLBACK_URL,
    AccountReference: paymentReference.trim(),
    TransactionDesc: env.MPESA_TRANSACTION_DESC,
  };

  try {
    const response = await darajaClient.post(
      "/mpesa/stkpush/v1/processrequest",
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    const data = response.data ?? {};

    if (
      data.ResponseCode !== "0" ||
      !data.CheckoutRequestID ||
      !data.MerchantRequestID
    ) {
      const error = new Error(
        data.ResponseDescription ||
          data.errorMessage ||
          "Daraja did not accept the STK Push request.",
      );

      error.status = 502;
      error.providerResponseCode = data.ResponseCode;

      throw error;
    }

    return {
      merchantRequestId: data.MerchantRequestID,
      checkoutRequestId: data.CheckoutRequestID,
      responseCode: data.ResponseCode,
      responseDescription: data.ResponseDescription,
      customerMessage: data.CustomerMessage || null,
    };
  } catch (error) {
    if (error.status) {
      throw error;
    }

    const safeError = new Error(
      error.response?.data?.errorMessage ||
        "The STK Push request could not be confirmed.",
    );

    safeError.status = 502;
    safeError.providerStatus = error.response?.status;
    safeError.providerResponseCode =
      error.response?.data?.errorCode || null;

    // A timeout or network failure may mean Daraja received
    // the request even though our server received no response.
    safeError.outcomeUnknown =
      !error.response ||
      error.code === "ECONNABORTED" ||
      error.code === "ETIMEDOUT";

    throw safeError;
  }
}


export async function queryDarajaStkStatus({
  checkoutRequestId,
}) {
  requireStkQueryConfiguration();

  if (
    typeof checkoutRequestId !== "string" ||
    !checkoutRequestId.trim() ||
    checkoutRequestId.trim().length > 128
  ) {
    const error = new Error(
      "A valid CheckoutRequestID is required.",
    );
    error.code = "STK_QUERY_INVALID_REQUEST";
    error.status = 400;
    throw error;
  }

  const normalizedCheckoutRequestId =
    checkoutRequestId.trim();

  const timestamp = getNairobiTimestamp();

  const password = createStkPassword({
    shortcode: env.MPESA_SHORTCODE,
    passkey: env.MPESA_PASSKEY,
    timestamp,
  });

  let accessToken;

  try {
    accessToken = await getDarajaAccessToken();
  } catch (cause) {
    const error = new Error(
      "Unable to authenticate before querying the STK transaction.",
      { cause },
    );

    error.code = "STK_QUERY_UNAVAILABLE";
    error.status = 503;
    error.retryable = true;

    throw error;
  }

  const payload = {
    BusinessShortCode: env.MPESA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    CheckoutRequestID: normalizedCheckoutRequestId,
  };

  try {
    const response = await darajaClient.post(
      "/mpesa/stkpushquery/v1/query",
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    const data = response.data ?? {};

    if (
      data.CheckoutRequestID &&
      data.CheckoutRequestID !== normalizedCheckoutRequestId
    ) {
      const error = new Error(
        "Daraja returned a mismatched CheckoutRequestID.",
      );

      error.code = "STK_QUERY_IDENTIFIERS_MISMATCH";
      error.status = 409;
      error.retryable = false;

      throw error;
    }

    return {
      responseCode: data.ResponseCode ?? null,
      responseDescription:
        data.ResponseDescription ?? null,
      merchantRequestId: data.MerchantRequestID ?? null,
      checkoutRequestId: data.CheckoutRequestID ?? null,
      resultCode:
        data.ResultCode !== undefined &&
        data.ResultCode !== null
          ? String(data.ResultCode)
          : null,
      resultDescription: data.ResultDesc ?? null,
    };
  } catch (cause) {
    if (
      cause.code === "STK_QUERY_IDENTIFIERS_MISMATCH"
    ) {
      throw cause;
    }

    const providerStatus = cause.response?.status;
    const providerCode =
      cause.response?.data?.errorCode || null;

    const retryable =
      !cause.response ||
      providerStatus === 408 ||
      providerStatus === 425 ||
      providerStatus === 429 ||
      providerStatus >= 500 ||
      cause.code === "ECONNABORTED" ||
      cause.code === "ETIMEDOUT";

    const error = new Error(
      retryable
        ? "Daraja STK Query is temporarily unavailable."
        : "Daraja rejected the STK Query request.",
      { cause },
    );

    error.code = retryable
      ? "STK_QUERY_UNAVAILABLE"
      : "STK_QUERY_REJECTED";

    error.status = retryable ? 503 : 502;
    error.retryable = retryable;
    error.providerStatus = providerStatus || null;
    error.providerCode = providerCode;

    throw error;
  }
}
