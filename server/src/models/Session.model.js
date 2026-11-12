
import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    tokenHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    userAgent: {
      type: String,
      maxlength: 500,
      default: null,
    },

    ipAddress: {
      type: String,
      maxlength: 100,
      default: null,
    },

    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

sessionSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 },
);

const Session = mongoose.model("Session", sessionSchema);

export default Session;
