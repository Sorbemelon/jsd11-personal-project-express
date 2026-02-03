// src/utils/s3.js
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import crypto from "crypto";
import path from "path";

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET;
const BASE_URL = process.env.AWS_S3_BASE_URL;

/* ======================================================
 * Utils
 * ====================================================== */
const sanitize = (p = "") =>
  String(p).replace(/^\/+|\/+$/g, "");

const normalizeFolderKey = (folderKey) => {
  if (!folderKey) return "";

  // already a string path
  if (typeof folderKey === "string") {
    return sanitize(folderKey);
  }

  // breadcrumb array → use names
  if (Array.isArray(folderKey)) {
    return folderKey
      .map((node) =>
        typeof node === "string"
          ? node
          : node?.name
      )
      .filter(Boolean)
      .map((n) =>
        n.trim().toLowerCase().replace(/\s+/g, "-")
      )
      .join("/");
  }

  throw new Error("Invalid folderKey type");
};

/* ======================================================
 * Build unique S3 object key
 * ====================================================== */
const buildObjectKey = (folderKey, filename) => {
  const cleanFolder = normalizeFolderKey(folderKey);

  const ext = path.extname(filename);
  const base = path.basename(filename, ext);

  return cleanFolder
    ? `${cleanFolder}/${base}${ext}`
    : `${base}${ext}`;
};

/* ======================================================
 * Upload file
 * ====================================================== */
export const uploadToS3 = async ({
  buffer,
  mimeType,
  filename,
  folderKey,
}) => {
  if (!buffer) throw new Error("Missing file buffer");
  if (!filename) throw new Error("Missing filename");

  const key = buildObjectKey(folderKey, filename);

  const uploader = new Upload({
    client: s3,
    params: {
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    },
  });

  await uploader.done();

  return {
    key,
    url: `${BASE_URL}/${key}`,
  };
};

/* ======================================================
 * Create S3 folder (zero-byte object)
 * ====================================================== */
export const createS3Folder = async (folderPath) => {
  const key = sanitize(folderPath).endsWith("/")
    ? sanitize(folderPath)
    : `${sanitize(folderPath)}/`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: "",
    })
  );

  return {
    key,
    url: `${BASE_URL}/${key}`,
  };
};

/* ======================================================
 * Delete single object
 * ====================================================== */
export const deleteFromS3 = async (key) => {
  if (!key) return;

  await s3.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
};

/* ======================================================
 * Delete entire prefix (folder)
 * ====================================================== */
export const deletePrefixFromS3 = async (prefix) => {
  const cleanPrefix = sanitize(prefix);

  let continuationToken;
  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: cleanPrefix,
        ContinuationToken: continuationToken,
      })
    );

    if (!res.Contents?.length) break;

    await s3.send(
      new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: {
          Objects: res.Contents.map((o) => ({ Key: o.Key })),
        },
      })
    );

    continuationToken = res.NextContinuationToken;
  } while (continuationToken);
};
