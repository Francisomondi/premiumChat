
import mongoose from "mongoose";

export const MPESA_EVIDENCE_SOURCES = Object.freeze({
  DARAJA_STK_QUERY: "DARAJA_STK_QUERY",
});

const mpesaFinancialVerificationSchema = new mongoose.Schema(
  {
    paymentTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentTransaction",
      required: true,
      immutable: true,
    },

    callbackEventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MpesaCallbackEvent",
      required: true,
      immutable: true,
    },

    evidenceSource: {
      type: String,
      enum: Object.values(MPESA_EVIDENCE_SOURCES),
      required: true,
      immutable: true,
    },

    merchantRequestId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
    },

    checkoutRequestId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
    },

    resultCode: {
      type: String,
      required: true,
      immutable: true,
    },

    resultDescription: {
      type: String,
      default: null,
      immutable: true,
      maxlength: 1000,
    },

    amountKes: {
      type: Number,
      required: true,
      immutable: true,
      min: 1,
      max: 100000,
    },

    mpesaReceiptNumber: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
    },

    phoneNumber: {
      type: String,
      default: null,
      immutable: true,
      select: false,
    },

    verifiedAt: {
      type: Date,
      required: true,
      immutable: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

mpesaFinancialVerificationSchema.index(
  { paymentTransactionId: 1 },
  { unique: true },
);

mpesaFinancialVerificationSchema.index(
  { callbackEventId: 1 },
  { unique: true },
);

mpesaFinancialVerificationSchema.index(
  { mpesaReceiptNumber: 1 },
  { unique: true },
);

mpesaFinancialVerificationSchema.index({
  checkoutRequestId: 1,
  merchantRequestId: 1,
});

const MpesaFinancialVerification =
  mongoose.models.MpesaFinancialVerification ||
  mongoose.model(
    "MpesaFinancialVerification",
    mpesaFinancialVerificationSchema,
  );

export default MpesaFinancialVerification;
