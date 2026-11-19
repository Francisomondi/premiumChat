
import mongoose from "mongoose";

export const SUBSCRIPTION_STATUSES = Object.freeze({
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  EXPIRED: "EXPIRED",
  CANCELLED: "CANCELLED",
  PAYMENT_FAILED: "PAYMENT_FAILED",
});

const creatorSubscriptionSchema = new mongoose.Schema(
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

    creatorProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CreatorProfile",
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
      enum: Object.values(SUBSCRIPTION_STATUSES),
      default: SUBSCRIPTION_STATUSES.PENDING,
      required: true,
      index: true,
    },

    startedAt: {
      type: Date,
      default: null,
    },

    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    lastPaymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentTransaction",
      default: null,
    },
        clientRequestId: {
      type: String,
      required: true,
      trim: true,
      minlength: 16,
      maxlength: 100,
      immutable: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

creatorSubscriptionSchema.index({
  fanId: 1,
  creatorId: 1,
  status: 1,
  expiresAt: 1,
});

creatorSubscriptionSchema.index({
  creatorId: 1,
  createdAt: -1,
});

creatorSubscriptionSchema.index(
  { fanId: 1, clientRequestId: 1 },
  { unique: true },
);

const CreatorSubscription = mongoose.model(
  "CreatorSubscription",
  creatorSubscriptionSchema,
);

export default CreatorSubscription;
