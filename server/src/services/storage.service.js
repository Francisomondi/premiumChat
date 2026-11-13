
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
