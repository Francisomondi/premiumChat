
import { Router } from "express";
import rateLimit from "express-rate-limit";

import {
  requestVideoUpload,
  completeVideoUploadRequest,
  getMyMedia,
  publishCreatorMediaRequest,
  unpublishCreatorMediaRequest,
} from "../controllers/media.controller.js";

import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { requireTrustedOrigin } from "../middleware/requireTrustedOrigin.js";

const router = Router();

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many upload attempts. Please try again later.",
  },
});

router.use(requireAuth, requireRole("CREATOR"));

router.get("/mine", getMyMedia);

router.post(
  "/uploads",
  requireTrustedOrigin,
  uploadLimiter,
  requestVideoUpload,
);

router.post(
  "/:mediaId/complete",
  requireTrustedOrigin,
  completeVideoUploadRequest,
);

router.patch(
  "/:mediaId/publish",
  requireTrustedOrigin,
  publishCreatorMediaRequest,
);

router.patch(
  "/:mediaId/unpublish",
  requireTrustedOrigin,
  unpublishCreatorMediaRequest,
);

export default router;
