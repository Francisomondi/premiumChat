
import { z } from "zod";

const MAX_VIDEO_SIZE = 200 * 1024 * 1024;

export const createVideoUploadSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2)
    .max(100),

  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .default(""),

  mimeType: z.enum([
    "video/mp4",
    "video/webm",
  ]),

  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_VIDEO_SIZE),
});
