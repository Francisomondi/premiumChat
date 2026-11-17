
import mongoose from "mongoose";

export const MEDIA_PURCHASE_STATUSES = Object.freeze({
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  REFUNDED: "REFUNDED",
  DISPUTED: "DISPUTED",
  REVOKED: "REVOKED",
});

const mediaPurchaseSchema = new mongoose.Schema(
  {
    fanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    mediaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Media",
      required: true,
      index: true,
    },

    amountKes: {
      type: Number,
      required: true,
      min: 1,
    },

    currency: {
      type: String,
      enum: ["KES"],
      default: "KES",
      required: true,
    },

    status: {
      type: String,
      enum: Object.values(MEDIA_PURCHASE_STATUSES),
      default: MEDIA_PURCHASE_STATUSES.PENDING,
      required: true,
      index: true,
    },

    purchasedAt: {
      type: Date,
      default: null,
    },

    refundedAt: {
      type: Date,
      default: null,
    },

    lastPaymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentTransaction",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

mediaPurchaseSchema.index({
  fanId: 1,
  mediaId: 1,
  status: 1,
});

mediaPurchaseSchema.index({
  creatorId: 1,
  createdAt: -1,
});

const MediaPurchase = mongoose.model(
  "MediaPurchase",
  mediaPurchaseSchema,
);

export default MediaPurchase;
