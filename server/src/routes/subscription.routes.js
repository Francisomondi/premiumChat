
import { Router } from "express";
import rateLimit from "express-rate-limit";

import {
  createSubscriptionRequest,
} from "../controllers/subscription.controller.js";

import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { requireTrustedOrigin } from "../middleware/requireTrustedOrigin.js";

const router = Router();

const subscriptionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many subscription attempts. Please try again later.",
  },
});

router.use(requireAuth, requireRole("FAN"));

router.post(
  "/",
  requireTrustedOrigin,
  subscriptionLimiter,
  createSubscriptionRequest,
);

export default router;
