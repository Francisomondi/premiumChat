
import { randomUUID } from "node:crypto";

import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

import { env } from "../config/env.js";

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
} = env;

const requiredValues = {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
};

const missing = Object.entries(requiredValues)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length) {
  console.error("Missing R2 configuration:", missing.join(", "));
  process.exit(1);
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const key = `connection-tests/${randomUUID()}.txt`;

let uploaded = false;

try {
  console.log("Testing Cloudflare R2 connection...");

  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: "Premium Chat R2 connection test",
      ContentType: "text/plain",
    }),
  );

  uploaded = true;
  console.log("PASS: Object upload");

  const result = await client.send(
    new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    }),
  );

  if (
  result.ContentLength !==
  Buffer.byteLength("Premium Chat R2 connection test")
) {
    throw new Error("Uploaded object metadata did not match.");
  }

  console.log("PASS: Object metadata verification");

  await client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    }),
  );

  uploaded = false;
  console.log("PASS: Test object cleanup");

  console.log("\nR2 CONNECTION SUCCESSFUL.");
} catch (error) {
  console.error("\nR2 CONNECTION FAILED.");
  console.error("Error:", error.name);
  console.error("Message:", error.message);

  process.exitCode = 1;
} finally {
  if (uploaded) {
    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: key,
        }),
      );
    } catch {
      console.error("Warning: Could not clean up the test object.");
    }
  }

  client.destroy();
}
