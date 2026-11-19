
import mongoose from "mongoose";

export const MPESA_CALLBACK_STATUSES = Object.freeze({
  RECEIVED: "RECEIVED",
  PROCESSING: "PROCESSING",
  RECONCILED: "RECONCILED",
  UNMATCHED: "UNMATCHED",
  MANUAL_REVIEW: "MANUAL_REVIEW",
  FAILED: "FAILED",
});

const mpesaCallbackEventSchema = new mongoose.Schema(
  {
    merchantRequestId: {
      type: String,
      trim: true,
      default: null,
    },

    checkoutRequestId: {
      type: String,
      trim: true,
      default: null,
    },

    resultCode: {
      type: Number,
      default: null,
    },

    resultDescription: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },

    amountKes: {
      type: Number,
      min: 0,
      default: null,
    },

    mpesaReceiptNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    transactionDate: {
      type: String,
      trim: true,
      default: null,
    },

    phoneNumber: {
      type: String,
      trim: true,
      default: null,
    },

    callbackPayload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      select: false,
    },

    paymentTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentTransaction",
      default: null,
    },

    status: {
      type: String,
      enum: Object.values(MPESA_CALLBACK_STATUSES),
      default: MPESA_CALLBACK_STATUSES.RECEIVED,
      required: true,
    },

    processingAttempts: {
      type: Number,
      min: 0,
      default: 0,
    },

    processingLeaseOwner: {
      type: String,
      trim: true,
      default: null,
      select: false,
    },

    processingLeaseExpiresAt: {
      type: Date,
      default: null,
    },

    processedAt: {
      type: Date,
      default: null,
    },

    lastError: {
      type: String,
      maxlength: 2000,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

mpesaCallbackEventSchema.index(
  { checkoutRequestId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      checkoutRequestId: { $type: "string" },
    },
  },
);

mpesaCallbackEventSchema.index({
  status: 1,
  createdAt: 1,
});

mpesaCallbackEventSchema.index({
  status: 1,
  processingLeaseExpiresAt: 1,
});

mpesaCallbackEventSchema.index({
  paymentTransactionId: 1,
  createdAt: -1,
});

const MpesaCallbackEvent =
  mongoose.models.MpesaCallbackEvent ||
  mongoose.model("MpesaCallbackEvent", mpesaCallbackEventSchema);

export default MpesaCallbackEvent;
