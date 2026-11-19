
import mongoose from "mongoose";

export const PAYMENT_PURPOSES = Object.freeze({
  SUBSCRIPTION_INITIAL: "SUBSCRIPTION_INITIAL",
  SUBSCRIPTION_RENEWAL: "SUBSCRIPTION_RENEWAL",
  MEDIA_PURCHASE: "MEDIA_PURCHASE",
});

export const PAYMENT_STATUSES = Object.freeze({
  PENDING: "PENDING",
  INITIATING: "INITIATING",
  PROCESSING: "PROCESSING",
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
  UNKNOWN: "UNKNOWN",
  REQUIRES_RECONCILIATION: "REQUIRES_RECONCILIATION",
  CANCELLED: "CANCELLED",
});

const paymentTransactionSchema = new mongoose.Schema(
  {
    paymentReference: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
    },

    clientRequestId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      minlength: 16,
      maxlength: 100,
    },

    fanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
      index: true,
    },

    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
      index: true,
    },

    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CreatorSubscription",
      default: null,
      immutable: true,
    },

    mediaPurchaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MediaPurchase",
      default: null,
      immutable: true,
    },

    purpose: {
      type: String,
      enum: Object.values(PAYMENT_PURPOSES),
      required: true,
      immutable: true,
      index: true,
    },

    amountKes: {
      type: Number,
      required: true,
      min: 1,
      max: 100000,
      immutable: true,
    },

    currency: {
      type: String,
      enum: ["KES"],
      default: "KES",
      required: true,
      immutable: true,
    },

    phoneNumber: {
    type: String,
    required: true,
    immutable: true,
    select: false,
    },

    phoneFingerprint: {
      type: String,
      required: true,
      immutable: true,
      select: false,
    },

    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUSES),
      default: PAYMENT_STATUSES.PENDING,
      required: true,
      index: true,
    },

    initiationStatus: {
      type: String,
      enum: [
        "NOT_STARTED",
        "DISPATCHING",
        "ACCEPTED",
        "REJECTED",
        "UNKNOWN",
      ],
      default: "NOT_STARTED",
      required: true,
    },

    merchantRequestId: {
      type: String,
      default: null,
    },

    checkoutRequestId: {
      type: String,
      default: null,
      index: true,
    },

    mpesaReceiptNumber: {
      type: String,
      default: null,
      index: true,
    },

    resultCode: {
      type: String,
      default: null,
    },

    resultDescription: {
      type: String,
      default: null,
    },

    initiationAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    initiatedAt: {
      type: Date,
      default: null,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },

    failedAt: {
      type: Date,
      default: null,
    },

    reconciliationRequiredAt: {
      type: Date,
      default: null,
    },

    providerResponseCode: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

paymentTransactionSchema.index(
  { fanId: 1, clientRequestId: 1 },
  { unique: true },
);

paymentTransactionSchema.index({
  status: 1,
  createdAt: 1,
});

paymentTransactionSchema.index(
  { merchantRequestId: 1, checkoutRequestId: 1 },
  { sparse: true },
);

const PaymentTransaction =
  mongoose.models.PaymentTransaction ||
  mongoose.model("PaymentTransaction", paymentTransactionSchema);

export default PaymentTransaction;
