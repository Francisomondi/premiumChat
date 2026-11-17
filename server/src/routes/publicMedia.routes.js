import { Router } from "express";
import rateLimit from "express-rate-limit";

import { requireAuth } from "../middleware/requireAuth.js";

import {
  getPublicVideoFeedRequest,
  getPublicCreatorVideosRequest,
  getPublicVideoPlaybackRequest,
} from "../controllers/publicMedia.controller.js";

const router = Router();

const discoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many video requests. Please try again later.",
  },
});

const playbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many playback requests. Please try again later.",
  },
});

// These endpoints require a valid session.
// The service also checks FAN role, ACTIVE status and age verification.
router.use(requireAuth);

router.get(
  "/feed",
  discoveryLimiter,
  getPublicVideoFeedRequest,
);

router.get(
  "/creators/:username",
  discoveryLimiter,
  getPublicCreatorVideosRequest,
);

router.get(
  "/:mediaId/playback",
  playbackLimiter,
  getPublicVideoPlaybackRequest,
);

export default router;