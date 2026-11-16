
import { spawn } from "node:child_process";

import {
  mkdtemp, 
  rm,
  stat,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import Media, {
  MEDIA_STATUSES,
} from "../models/Media.model.js";

import {
  downloadPrivateObject,
  uploadPrivateFile,
} from "./storage.service.js";

const MAX_PROCESSING_ATTEMPTS = 3;
const LEASE_DURATION_MS = 15 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 60 * 1000;

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        new Error(
          `${command} exited with code ${code}: ${stderr.slice(-4000)}`,
        ),
      );
    });
  });
}

async function probeVideo(filePath) {
  const { stdout } = await runCommand("ffprobe", [
    "-v",
    "error",
    "-show_streams",
    "-show_format",
    "-of",
    "json",
    filePath,
  ]);

  let metadata;

  try {
    metadata = JSON.parse(stdout);
  } catch {
    throw new Error("FFprobe returned invalid video metadata.");
  }

  const videoStream = metadata.streams?.find(
    (stream) => stream.codec_type === "video",
  );

  if (!videoStream) {
    throw new Error("The uploaded file does not contain a video stream.");
  }

  const duration = Number(
    videoStream.duration ?? metadata.format?.duration,
  );

  const width = Number(videoStream.width);
  const height = Number(videoStream.height);

  if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error("The uploaded video has invalid dimensions or duration.");
  }

  return { duration, width, height };
}

async function createPlaybackVideo(inputPath, outputPath) {
  await runCommand("ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-vf",
    "scale=w='min(1920,iw)':h='min(1920,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    "-max_muxing_queue_size",
    "1024",
    outputPath,
  ]);
}

async function createThumbnail(inputPath, outputPath, duration) {
  const seekSeconds = Math.max(0, Math.min(1, duration * 0.25));

  await runCommand("ffmpeg", [
    "-y",
    "-ss",
    String(seekSeconds),
    "-i",
    inputPath,
    "-frames:v",
    "1",
    "-vf",
    "scale=w='min(640,iw)':h='min(640,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
    "-q:v",
    "3",
    outputPath,
  ]);
}

function createOutputKeys(originalStorageKey) {
  const extension = path.posix.extname(originalStorageKey);
  const filename = path.posix.basename(
    originalStorageKey,
    extension,
  );

  const creatorDirectory = path.posix.dirname(
    path.posix.dirname(originalStorageKey),
  );

  return {
    processedStorageKey:
      `${creatorDirectory}/processed/${filename}.mp4`,
    thumbnailStorageKey:
      `${creatorDirectory}/thumbnails/${filename}.jpg`,
  };
}

async function claimNextMedia(workerId) {
  const now = new Date();

  return Media.findOneAndUpdate(
    {
      status: MEDIA_STATUSES.PROCESSING,
      processingAttempts: { $lt: MAX_PROCESSING_ATTEMPTS },
      $or: [
        { processingLeaseExpiresAt: null },
        { processingLeaseExpiresAt: { $exists: false } },
        { processingLeaseExpiresAt: { $lte: now } },
      ],
    },
    {
      $set: {
        processingLeaseOwner: workerId,
        processingLeaseExpiresAt: new Date(
          now.getTime() + LEASE_DURATION_MS,
        ),
      },
      $inc: {
        processingAttempts: 1,
      },
    },
    {
      new: true,
      sort: { createdAt: 1 },
    },
  ).select("+storageKey");
}

async function extendLease(mediaId, workerId) {
  const result = await Media.updateOne(
    {
      _id: mediaId,
      status: MEDIA_STATUSES.PROCESSING,
      processingLeaseOwner: workerId,
    },
    {
      $set: {
        processingLeaseExpiresAt: new Date(
          Date.now() + LEASE_DURATION_MS,
        ),
      },
    },
  );

  return result.modifiedCount === 1;
}

async function processClaimedMedia(media, workerId) {
  if (!media.storageKey) {
    throw new Error("The original media storage key is missing.");
  }

  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "premium-chat-media-"),
  );

  const inputPath = path.join(temporaryDirectory, "original");
  const outputPath = path.join(temporaryDirectory, "processed.mp4");
  const thumbnailPath = path.join(temporaryDirectory, "thumbnail.jpg");

  const heartbeat = setInterval(() => {
    extendLease(media._id, workerId).catch((error) => {
      console.error(
        `Could not extend processing lease for ${media._id}:`,
        error.message,
      );
    });
  }, HEARTBEAT_INTERVAL_MS);

  heartbeat.unref?.();

  try {
    console.log(`Downloading original video ${media._id}...`);

    await downloadPrivateObject(media.storageKey, inputPath);

    const originalStats = await stat(inputPath);

    if (!originalStats.size) {
      throw new Error("The uploaded video file is empty.");
    }

    const metadata = await probeVideo(inputPath);

    console.log(`Transcoding video ${media._id}...`);

    await createPlaybackVideo(inputPath, outputPath);
    await createThumbnail(
      inputPath,
      thumbnailPath,
      metadata.duration,
    );

    const processedStats = await stat(outputPath);
    const thumbnailStats = await stat(thumbnailPath);

    if (!processedStats.size || !thumbnailStats.size) {
      throw new Error("Video processing produced an empty output file.");
    }

    const keys = createOutputKeys(media.storageKey);

    console.log(`Uploading processed assets for ${media._id}...`);

    await uploadPrivateFile({
      storageKey: keys.processedStorageKey,
      filePath: outputPath,
      contentType: "video/mp4",
      metadata: {
        "media-id": String(media._id),
        "asset-type": "processed-video",
      },
    });

    await uploadPrivateFile({
      storageKey: keys.thumbnailStorageKey,
      filePath: thumbnailPath,
      contentType: "image/jpeg",
      metadata: {
        "media-id": String(media._id),
        "asset-type": "thumbnail",
      },
    });

    const update = await Media.updateOne(
      {
        _id: media._id,
        status: MEDIA_STATUSES.PROCESSING,
        processingLeaseOwner: workerId,
      },
      {
        $set: {
          status: MEDIA_STATUSES.READY,
          processedStorageKey: keys.processedStorageKey,
          thumbnailStorageKey: keys.thumbnailStorageKey,
          durationSeconds: metadata.duration,
          width: metadata.width,
          height: metadata.height,
          processedSizeBytes: processedStats.size,
          processingCompletedAt: new Date(),
          moderationStatus: "PENDING",
          publicationStatus: "DRAFT",
          processingLeaseOwner: null,
          processingLeaseExpiresAt: null,
          processingError: null,
        },
      },
    );

    if (update.modifiedCount !== 1) {
      throw new Error(
        "The processing lease was lost before the media record could be finalized.",
      );
    }

    console.log(`Video ${media._id} is READY for moderation.`);
  } finally {
    clearInterval(heartbeat);

    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  }
}

async function recordProcessingFailure(media, workerId, error) {
  const attempts = media.processingAttempts ?? 1;
  const permanentlyFailed = attempts >= MAX_PROCESSING_ATTEMPTS;

  await Media.updateOne(
    {
      _id: media._id,
      status: MEDIA_STATUSES.PROCESSING,
      processingLeaseOwner: workerId,
    },
    {
      $set: {
        ...(permanentlyFailed
          ? { status: MEDIA_STATUSES.FAILED }
          : {}),
        processingError: String(error.message || error).slice(0, 2000),
        processingLeaseOwner: null,
        processingLeaseExpiresAt: null,
      },
    },
  );

  console.error(
    `Video ${media._id} processing failed (attempt ${attempts}/${MAX_PROCESSING_ATTEMPTS}):`,
    error.message || error,
  );
}

export async function processNextMedia(workerId) {
  const media = await claimNextMedia(workerId);

  if (!media) {
    return false;
  }

  console.log(
    `Claimed video ${media._id} (attempt ${media.processingAttempts}/${MAX_PROCESSING_ATTEMPTS}).`,
  );

  try {
    await processClaimedMedia(media, workerId);
  } catch (error) {
    await recordProcessingFailure(media, workerId, error);
  }

  return true;
}

export function createMediaWorkerId() {
  return `media-worker-${randomUUID()}`;
}
