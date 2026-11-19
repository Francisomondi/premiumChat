
import { Router } from "express";
import rateLimit from "express-rate-limit";

import {
  createMediaPurchaseRequest,
} from "../controllers/mediaPurchase.controller.js";

import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { requireTrustedOrigin } from "../middleware/requireTrustedOrigin.js";

const router = Router();

const mediaPurchaseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many purchase attempts. Please try again later.",
  },
});

router.use(requireAuth, requireRole("FAN"));

router.post(
  "/:mediaId",
  requireTrustedOrigin,
  mediaPurchaseLimiter,
  createMediaPurchaseRequest,
);

export default router;
