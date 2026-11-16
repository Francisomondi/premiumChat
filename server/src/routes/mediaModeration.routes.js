import { Router } from "express";

import {
  getModerationQueue,
  reviewMediaRequest,
  getMediaModerationPreviewRequest,
} from "../controllers/mediaModeration.controller.js";

import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { requireTrustedOrigin } from "../middleware/requireTrustedOrigin.js";

const router = Router();

router.use(requireAuth, requireRole("ADMIN"));

router.get("/", getModerationQueue);

router.get(
  "/:mediaId/preview",
  getMediaModerationPreviewRequest,
);

router.patch(
  "/:mediaId",
  requireTrustedOrigin,
  reviewMediaRequest,
);

export default router;