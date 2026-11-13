import CreatorProfile, {
  CREATOR_APPLICATION_STATUSES,
} from "../models/CreatorProfile.model.js";

import User, {
  USER_ROLES,
  USER_STATUSES,
} from "../models/User.model.js";

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function formatCreatorProfile(profile) {
  return {
    id: profile._id,
    userId: profile.userId?._id || profile.userId,
    username: profile.username,
    displayName: profile.displayName,
    bio: profile.bio,
    country: profile.country,
    applicationStatus: profile.applicationStatus,
    submittedAt: profile.submittedAt,
    reviewedAt: profile.reviewedAt,
    rejectionReason: profile.rejectionReason,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

export async function submitCreatorApplication(user, payload) {
  if (user.role !== USER_ROLES.CREATOR) {
    throw createError(
      "Only creator accounts can submit creator applications.",
      403,
    );
  }

  if (user.status !== USER_STATUSES.ACTIVE) {
    throw createError("Your account is not active.", 403);
  }

  if (!user.ageVerifiedAt) {
    throw createError(
        "You must verify that you are at least 18 before applying as a creator.",
        403,
    );
  }

  const existingProfile = await CreatorProfile.findOne({
    userId: user._id,
  });

  if (
    existingProfile?.applicationStatus ===
    CREATOR_APPLICATION_STATUSES.PENDING
  ) {
    throw createError(
      "You already have a creator application awaiting review.",
      409,
    );
  }

  if (
    existingProfile?.applicationStatus ===
    CREATOR_APPLICATION_STATUSES.APPROVED
  ) {
    throw createError(
      "Your creator profile is already approved.",
      409,
    );
  }

  const applicationData = {
    ...payload,
    userId: user._id,
    applicationStatus: CREATOR_APPLICATION_STATUSES.PENDING,
    submittedAt: new Date(),
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null,
  };

  let profile;

  if (existingProfile) {
    Object.assign(existingProfile, applicationData);
    profile = await existingProfile.save();
  } else {
    profile = await CreatorProfile.create(applicationData);
  }

  return formatCreatorProfile(profile);
}

export async function getMyCreatorProfile(userId) {
  const profile = await CreatorProfile.findOne({ userId });

  if (!profile) {
    return null;
  }

  return formatCreatorProfile(profile);
}

export async function updateMyCreatorProfile(userId, payload) {
  const profile = await CreatorProfile.findOne({ userId });

  if (!profile) {
    throw createError(
      "You have not submitted a creator application.",
      404,
    );
  }

  if (
    profile.applicationStatus !==
    CREATOR_APPLICATION_STATUSES.APPROVED
  ) {
    throw createError(
      "Only approved creators can edit their public profiles.",
      403,
    );
  }

  Object.assign(profile, payload);

  await profile.save();

  return formatCreatorProfile(profile);
}

export async function getPublicCreators({
  page = 1,
  limit = 20,
} = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(
    50,
    Math.max(1, Number(limit) || 20),
  );

  const query = {
    applicationStatus: CREATOR_APPLICATION_STATUSES.APPROVED,
  };

  const [profiles, total] = await Promise.all([
    CreatorProfile.find(query)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .populate({
        path: "userId",
        select: "role status",
        match: {
          role: USER_ROLES.CREATOR,
          status: USER_STATUSES.ACTIVE,
        },
      })
      .lean(),

    CreatorProfile.countDocuments(query),
  ]);

  const creators = profiles
    .filter((profile) => profile.userId)
    .map((profile) => ({
      id: profile._id,
      username: profile.username,
      displayName: profile.displayName,
      bio: profile.bio,
      country: profile.country,
      createdAt: profile.createdAt,
    }));

  return {
    creators,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: creators.length,
      totalApprovedProfiles: total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}

export async function getPublicCreatorByUsername(username) {
  const normalizedUsername = String(username || "")
    .trim()
    .toLowerCase();

  const profile = await CreatorProfile.findOne({
    username: normalizedUsername,
    applicationStatus: CREATOR_APPLICATION_STATUSES.APPROVED,
  })
    .populate({
      path: "userId",
      select: "role status",
      match: {
        role: USER_ROLES.CREATOR,
        status: USER_STATUSES.ACTIVE,
      },
    })
    .lean();

  if (!profile || !profile.userId) {
    throw createError("Creator profile was not found.", 404);
  }

  return {
    id: profile._id,
    username: profile.username,
    displayName: profile.displayName,
    bio: profile.bio,
    country: profile.country,
    createdAt: profile.createdAt,
  };
}

export async function getCreatorApplications({
  page = 1,
  limit = 20,
  status = CREATOR_APPLICATION_STATUSES.PENDING,
} = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(
    50,
    Math.max(1, Number(limit) || 20),
  );

  const query = {};

  if (status !== "ALL") {
    query.applicationStatus = status;
  }

  const [profiles, total] = await Promise.all([
    CreatorProfile.find(query)
      .sort({ submittedAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .populate("userId", "displayName email role status")
      .populate("reviewedBy", "displayName email")
      .lean(),

    CreatorProfile.countDocuments(query),
  ]);

  return {
    applications: profiles.map((profile) => ({
      id: profile._id,
      username: profile.username,
      displayName: profile.displayName,
      bio: profile.bio,
      country: profile.country,
      applicationStatus: profile.applicationStatus,
      submittedAt: profile.submittedAt,
      reviewedAt: profile.reviewedAt,
      rejectionReason: profile.rejectionReason,
      applicant: profile.userId
        ? {
            id: profile.userId._id,
            displayName: profile.userId.displayName,
            email: profile.userId.email,
            role: profile.userId.role,
            status: profile.userId.status,
          }
        : null,
      reviewer: profile.reviewedBy
        ? {
            id: profile.reviewedBy._id,
            displayName: profile.reviewedBy.displayName,
            email: profile.reviewedBy.email,
          }
        : null,
    })),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}

export async function reviewCreatorApplication({
  applicationId,
  adminId,
  status,
  rejectionReason,
}) {
  if (!["APPROVED", "REJECTED"].includes(status)) {
    throw createError("Invalid application review status.");
  }

  const update = {
    applicationStatus: status,
    reviewedAt: new Date(),
    reviewedBy: adminId,
    rejectionReason:
      status === "REJECTED" ? rejectionReason : null,
  };

  const profile = await CreatorProfile.findOneAndUpdate(
    {
      _id: applicationId,
      applicationStatus: CREATOR_APPLICATION_STATUSES.PENDING,
    },
    {
      $set: update,
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!profile) {
    const existing = await CreatorProfile.findById(applicationId);

    if (!existing) {
      throw createError("Creator application was not found.", 404);
    }

    throw createError(
      "This application has already been reviewed.",
      409,
    );
  }

  return formatCreatorProfile(profile);
}