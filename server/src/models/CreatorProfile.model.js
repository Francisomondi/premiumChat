import mongoose from "mongoose";

export const CREATOR_APPLICATION_STATUSES = Object.freeze({
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
});

const creatorProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },

    displayName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },

    bio: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 500,
    },

    country: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    applicationStatus: {
      type: String,
      enum: Object.values(CREATOR_APPLICATION_STATUSES),
      default: CREATOR_APPLICATION_STATUSES.PENDING,
      required: true,
    },

    submittedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    rejectionReason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

creatorProfileSchema.index({
  applicationStatus: 1,
  submittedAt: -1,
});

const CreatorProfile = mongoose.model(
  "CreatorProfile",
  creatorProfileSchema,
);

export default CreatorProfile;