import { Router } from "express";
import rateLimit from "express-rate-limit";

import {
  submitApplication,
  getMyProfile,
  updateMyProfile,
  listPublicCreators,
  listCreatorApplications,
  reviewApplication,
  getPublicCreatorProfile,
} from "../controllers/creator.controller.js";

import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { requireTrustedOrigin } from "../middleware/requireTrustedOrigin.js";

const router = Router();

const applicationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many application attempts. Please try again later.",
  },
});

// Public creator discovery.
// Only approved profiles belonging to active creator accounts are returned.
router.get("/", listPublicCreators);


// Creator application and profile.
router.post(
  "/application",
  requireTrustedOrigin,
  requireAuth,
  requireRole("CREATOR"),
  applicationLimiter,
  submitApplication,
);

router.get(
  "/me",
  requireAuth,
  requireRole("CREATOR"),
  getMyProfile,
);

router.patch(
  "/me",
  requireTrustedOrigin,
  requireAuth,
  requireRole("CREATOR"),
  updateMyProfile,
);

// Admin application management.
router.get(
  "/admin/applications",
  requireAuth,
  requireRole("ADMIN"),
  listCreatorApplications,
);

router.patch(
  "/admin/applications/:id/review",
  requireTrustedOrigin,
  requireAuth,
  requireRole("ADMIN"),
  reviewApplication,
);

router.get("/:username", getPublicCreatorProfile);

export default router;