
import { Router } from "express";
import rateLimit from "express-rate-limit";

import {
  requestVideoUpload,
  completeVideoUploadRequest,
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

router.use(
  requireTrustedOrigin,
  requireAuth,
  requireRole("CREATOR"),
);

router.post(
  "/uploads",
  uploadLimiter,
  requestVideoUpload,
);

router.post(
  "/:mediaId/complete",
  completeVideoUploadRequest,
);

export default router;
