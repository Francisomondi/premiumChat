
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { createWriteStream, createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";

import { env } from "../config/env.js";

let r2Client;

function getR2Config() {
  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME,
  } = env;

  if (
    !R2_ACCOUNT_ID ||
    !R2_ACCESS_KEY_ID ||
    !R2_SECRET_ACCESS_KEY ||
    !R2_BUCKET_NAME
  ) {
    const error = new Error(
      "Cloudflare R2 storage is not configured.",
    );

    error.status = 503;

    throw error;
  }

  return {
    accountId: R2_ACCOUNT_ID,
    bucket: R2_BUCKET_NAME,
  };
}

function getR2Client() {
  if (r2Client) {
    return r2Client;
  }

  const { accountId } = getR2Config();

  r2Client = new S3Client({
    region: "auto",

    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,

    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },

    requestChecksumCalculation: "WHEN_REQUIRED",
  });

  return r2Client;
}

export async function createVideoUploadUrl({
  storageKey,
  mimeType,
  creatorId,
  mediaId,
}) {
  const { bucket } = getR2Config();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: storageKey,
    ContentType: mimeType,

    Metadata: {
      "owner-id": String(creatorId),
      "media-id": String(mediaId),
    },
  });

  const uploadUrl = await getSignedUrl(
    getR2Client(),
    command,
    {
      expiresIn: 600,

      unhoistableHeaders: new Set([
        "x-amz-meta-owner-id",
        "x-amz-meta-media-id",
      ]),

      signableHeaders: new Set([
        "content-type",
        "x-amz-meta-owner-id",
        "x-amz-meta-media-id",
      ]),
    },
  );

  return {
    uploadUrl,

    requiredHeaders: {
      "Content-Type": mimeType,
      "x-amz-meta-owner-id": String(creatorId),
      "x-amz-meta-media-id": String(mediaId),
    },
  };
}

export async function getPrivateObjectMetadata(storageKey) {
  const { bucket } = getR2Config();

  const command = new HeadObjectCommand({
    Bucket: bucket,
    Key: storageKey,
  });

  return getR2Client().send(command);
}

export async function downloadPrivateObject(
  storageKey,
  destinationPath,
) {
  const { bucket } = getR2Config();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: storageKey,
  });

  const response = await getR2Client().send(command);

  if (!response.Body) {
    throw new Error("The private storage object has no content.");
  }

  await pipeline(
    response.Body,
    createWriteStream(destinationPath),
  );

  return {
    sizeBytes: response.ContentLength || null,
    contentType: response.ContentType || null,
  };
}

export async function uploadPrivateFile({
  storageKey,
  filePath,
  contentType,
  metadata = {},
}) {
  const { bucket } = getR2Config();

  const fileStats = await stat(filePath);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: storageKey,
    Body: createReadStream(filePath),
    ContentLength: fileStats.size,
    ContentType: contentType,
    Metadata: metadata,
  });

  await getR2Client().send(command);

  return {
    storageKey,
    sizeBytes: fileStats.size,
    contentType,
  };
}


export async function createPrivateReadUrl({
  storageKey,
  expiresIn = 180,
  contentType = "video/mp4",
}) {
  if (!storageKey) {
    const error = new Error("Private storage key is required.");
    error.status = 400;
    throw error;
  }

  const { bucket } = getR2Config();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: storageKey,
    ResponseContentType: contentType,
    ResponseContentDisposition: "inline",
  });

  return getSignedUrl(getR2Client(), command, {
    expiresIn,
  });
}