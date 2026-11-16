
import mongoose from "mongoose";

export const MEDIA_TYPES = Object.freeze({
  VIDEO: "VIDEO",
});

export const MEDIA_STATUSES = Object.freeze({
  UPLOADING: "UPLOADING",
  PROCESSING: "PROCESSING",
  READY: "READY",
  REJECTED: "REJECTED",
  FAILED: "FAILED",
});

export const MEDIA_MODERATION_STATUSES = Object.freeze({
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
});

export const MEDIA_PUBLICATION_STATUSES = Object.freeze({
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
});

export const MEDIA_ACCESS_POLICIES = Object.freeze({
  FREE: "FREE",
  SUBSCRIBERS_ONLY: "SUBSCRIBERS_ONLY",
  PURCHASE_ONLY: "PURCHASE_ONLY",
});

const mediaSchema = new mongoose.Schema(
  {
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

    mediaType: {
      type: String,
      enum: Object.values(MEDIA_TYPES),
      default: MEDIA_TYPES.VIDEO,
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    mimeType: {
      type: String,
      enum: ["video/mp4", "video/webm"],
      required: true,
    },

    sizeBytes: {
      type: Number,
      required: true,
      min: 1,
      max: 200 * 1024 * 1024,
    },

    storageKey: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },

    // Private processed video and thumbnail objects.
    processedStorageKey: {
      type: String,
      default: null,
      select: false,
    },

    thumbnailStorageKey: {
      type: String,
      default: null,
      select: false,
    },

    // Processing output metadata.
    durationSeconds: {
      type: Number,
      min: 0,
      default: null,
    },

    width: {
      type: Number,
      min: 1,
      default: null,
    },

    height: {
      type: Number,
      min: 1,
      default: null,
    },

    processedSizeBytes: {
      type: Number,
      min: 1,
      default: null,
    },

    status: {
      type: String,
      enum: Object.values(MEDIA_STATUSES),
      default: MEDIA_STATUSES.UPLOADING,
      required: true,
      index: true,
    },

    moderationStatus: {
      type: String,
      enum: Object.values(MEDIA_MODERATION_STATUSES),
      default: MEDIA_MODERATION_STATUSES.PENDING,
      required: true,
      index: true,
    },

    publicationStatus: {
      type: String,
      enum: Object.values(MEDIA_PUBLICATION_STATUSES),
      default: MEDIA_PUBLICATION_STATUSES.DRAFT,
      required: true,
    },

    accessPolicy: {
      type: String,
      enum: Object.values(MEDIA_ACCESS_POLICIES),
      default: MEDIA_ACCESS_POLICIES.FREE,
      required: true,
    },

    priceKes: {
      type: Number,
      min: 0,
      default: 0,
    },

    uploadExpiresAt: {
      type: Date,
      required: true,
    },

    uploadedAt: {
      type: Date,
      default: null,
    },

    processingStartedAt: {
      type: Date,
      default: null,
    },

    processingCompletedAt: {
      type: Date,
      default: null,
    },

    processingAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    processingLeaseOwner: {
      type: String,
      default: null,
    },

    processingLeaseExpiresAt: {
      type: Date,
      default: null,
    },

    processingError: {
      type: String,
      default: "",
      maxlength: 1000,
    },

    publishedAt: {
      type: Date,
      default: null,
    },

    rejectionReason: {
      type: String,
      default: "",
      maxlength: 1000,
    },
        moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    moderatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

mediaSchema.index({ creatorId: 1, createdAt: -1 });

mediaSchema.index({
  status: 1,
  processingLeaseExpiresAt: 1,
  processingAttempts: 1,
});

mediaSchema.index({
  status: 1,
  moderationStatus: 1,
  publicationStatus: 1,
});

const Media = mongoose.model("Media", mediaSchema);

export default Media;
