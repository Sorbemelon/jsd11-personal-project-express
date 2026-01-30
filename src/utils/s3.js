import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import path from "path";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Uploads a file buffer to S3
 */
export const uploadToS3 = async ({
  buffer,
  mimeType,
  originalName,
  userId,
}) => {
  if (!buffer) {
    throw new Error("Missing file buffer for S3 upload");
  }

  const ext = path.extname(originalName);
  const filename = crypto.randomUUID() + ext;

  // e.g. users/<userId>/files/<uuid>.pdf
  const key = `users/${userId}/files/${filename}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,

      // Optional but recommended
      Metadata: {
        originalName: originalName,
      },
    })
  );

  const url = `${process.env.AWS_S3_BASE_URL}/${key}`;

  return {
    key,
    url,
  };
};

export const deleteFromS3 = async (key) => {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    })
  );
};
