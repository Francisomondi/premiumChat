import { z } from "zod";

export const registerSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Display name must have at least 2 characters.")
    .max(40, "Display name cannot exceed 40 characters."),

  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .max(254)
    .transform((value) => value.toLowerCase()),

  password: z
    .string()
    .min(8, "Password must have at least 8 characters.")
    .max(72, "Password cannot exceed 72 characters."),

  role: z.enum(["FAN", "CREATOR"]).default("FAN"),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .max(254)
    .transform((value) => value.toLowerCase()),

  password: z
    .string()
    .min(1, "Password is required.")
    .max(72),
});

export const verifyAgeSchema = z.object({
  dateOfBirth: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      "Enter your date of birth in YYYY-MM-DD format.",
    )
    .refine((value) => {
      const [year, month, day] = value.split("-").map(Number);

      const date = new Date(
        Date.UTC(year, month - 1, day),
      );

      return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      );
    }, "Enter a valid date of birth.")
    .refine((value) => {
      const today = new Date().toISOString().slice(0, 10);
      return value <= today;
    }, "Date of birth cannot be in the future."),
});