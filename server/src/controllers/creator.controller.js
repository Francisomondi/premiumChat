import {
  creatorApplicationSchema,
  updateCreatorProfileSchema,
  reviewCreatorApplicationSchema,
} from "../validators/creator.validator.js";

import {
  submitCreatorApplication,
  getMyCreatorProfile,
  updateMyCreatorProfile,
  getPublicCreators,
  getPublicCreatorByUsername,
  getCreatorApplications,
  reviewCreatorApplication,
} from "../services/creator.service.js";

function sendValidationError(res, error) {
  return res.status(400).json({
    success: false,
    message: "Please check the submitted information.",
    errors: error.issues?.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  });
}

export async function submitApplication(req, res, next) {
  try {
    const validation = creatorApplicationSchema.safeParse(req.body);

    if (!validation.success) {
      return sendValidationError(res, validation.error);
    }

    const profile = await submitCreatorApplication(
      req.user,
      validation.data,
    );

    return res.status(201).json({
      success: true,
      message: "Your creator application has been submitted.",
      profile,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getMyProfile(req, res, next) {
  try {
    const profile = await getMyCreatorProfile(req.user._id);

    return res.status(200).json({
      success: true,
      profile,
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateMyProfile(req, res, next) {
  try {
    const validation = updateCreatorProfileSchema.safeParse(
      req.body,
    );

    if (!validation.success) {
      return sendValidationError(res, validation.error);
    }

    const profile = await updateMyCreatorProfile(
      req.user._id,
      validation.data,
    );

    return res.status(200).json({
      success: true,
      message: "Your creator profile has been updated.",
      profile,
    });
  } catch (error) {
    return next(error);
  }
}

export async function listPublicCreators(req, res, next) {
  try {
    const result = await getPublicCreators({
      page: req.query.page,
      limit: req.query.limit,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function listCreatorApplications(req, res, next) {
  try {
    const allowedStatuses = [
      "PENDING",
      "APPROVED",
      "REJECTED",
      "ALL",
    ];

    const status = req.query.status || "PENDING";

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application status filter.",
      });
    }

    const result = await getCreatorApplications({
      page: req.query.page,
      limit: req.query.limit,
      status,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function reviewApplication(req, res, next) {
  try {
    const validation = reviewCreatorApplicationSchema.safeParse(
      req.body,
    );

    if (!validation.success) {
      return sendValidationError(res, validation.error);
    }

    const profile = await reviewCreatorApplication({
      applicationId: req.params.id,
      adminId: req.user._id,
      ...validation.data,
    });

    return res.status(200).json({
      success: true,
      message:
        validation.data.status === "APPROVED"
          ? "Creator application approved."
          : "Creator application rejected.",
      profile,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getPublicCreatorProfile(req, res, next) {
  try {
    const profile = await getPublicCreatorByUsername(
      req.params.username,
    );

    return res.status(200).json({
      success: true,
      profile,
    });
  } catch (error) {
    return next(error);
  }
}