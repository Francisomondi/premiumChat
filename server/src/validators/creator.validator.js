import { z } from "zod";

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must contain at least 3 characters.")
  .max(30, "Username cannot exceed 30 characters.")
  .regex(
    /^[a-zA-Z0-9_]+$/,
    "Username can only contain letters, numbers, and underscores.",
  )
  .transform((value) => value.toLowerCase());

const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Display name must contain at least 2 characters.")
  .max(50, "Display name cannot exceed 50 characters.");

const bioSchema = z
  .string()
  .trim()
  .min(10, "Bio must contain at least 10 characters.")
  .max(500, "Bio cannot exceed 500 characters.");

const countrySchema = z
  .string()
  .trim()
  .min(2, "Please provide a valid country.")
  .max(80, "Country cannot exceed 80 characters.");

export const creatorApplicationSchema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
  bio: bioSchema,
  country: countrySchema,
});

export const updateCreatorProfileSchema = z
  .object({
    username: usernameSchema.optional(),
    displayName: displayNameSchema.optional(),
    bio: bioSchema.optional(),
    country: countrySchema.optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    "Provide at least one profile field to update.",
  );

export const reviewCreatorApplicationSchema = z
  .object({
    status: z.enum(["APPROVED", "REJECTED"]),
    rejectionReason: z
      .string()
      .trim()
      .max(500, "Rejection reason cannot exceed 500 characters.")
      .optional(),
  })
  .refine(
    (data) =>
      data.status !== "REJECTED" ||
      Boolean(data.rejectionReason?.trim()),
    {
      message: "A rejection reason is required.",
      path: ["rejectionReason"],
    },
  );