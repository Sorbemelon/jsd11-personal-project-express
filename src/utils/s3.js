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
   UPLOAD FILE (SAFE FOR STREAMS / LARGE FILES)
====================================================== */
export const uploadToS3 = async ({
  buffer,
  mimeType,
  originalName,
  userId,
  folderKey = "files",
}) => {
  if (!buffer) {
    throw new Error("Missing file buffer for S3 upload");
  }

  const ext = path.extname(originalName);
  const filename = `${crypto.randomUUID()}${ext}`;
  const key = `users/${userId}/${folderKey}/${filename}`;

  const upload = new Upload({
    client: s3,
    params: {
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      Metadata: {
        originalName,
      },
    },
  });

  await upload.done();

  return {
    key,
    url: `${BASE_URL}/${key}`,
  };
};

/* ======================================================
   CREATE FOLDER (ZERO-BYTE OBJECT)
====================================================== */
export const createS3Folder = async (key) => {
  if (!key) throw new Error("Folder key is required");

  const folderKey = key.endsWith("/") ? key : `${key}/`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: folderKey,
      Body: "",
    })
  );

  return {
    key: folderKey,
    url: `${BASE_URL}/${folderKey}`,
  };
};

/* ======================================================
   DELETE SINGLE FILE
====================================================== */
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
   DELETE FOLDER (PREFIX DELETE — REQUIRED)
====================================================== */
export const deletePrefixFromS3 = async (prefix) => {
  if (!prefix) return;

  let continuationToken;

  do {
    const listRes = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    const objects = listRes.Contents?.map((obj) => ({
      Key: obj.Key,
    }));

    if (objects?.length) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: BUCKET,
          Delete: {
            Objects: objects,
            Quiet: true,
          },
        })
      );
    }

    continuationToken = listRes.IsTruncated
      ? listRes.NextContinuationToken
      : undefined;
  } while (continuationToken);
};
