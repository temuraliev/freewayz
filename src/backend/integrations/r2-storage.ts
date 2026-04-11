import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import crypto from "crypto";

const getS3Client = () =>
  new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

const bucket = () => process.env.R2_BUCKET_NAME || "freewayz-images";
const publicUrl = () => process.env.R2_PUBLIC_URL || "";

function generateKey(prefix: string, ext = "jpg") {
  const hash = crypto.randomBytes(8).toString("hex");
  const ts = Date.now();
  return `${prefix}/${ts}-${hash}.${ext}`;
}

export async function uploadImage(
  buffer: Buffer,
  productId: number,
  contentType = "image/jpeg"
): Promise<{ url: string; r2Key: string }> {
  const key = generateKey(`products/${productId}`, contentType.includes("png") ? "png" : "jpg");
  const client = getS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return {
    url: `${publicUrl()}/${key}`,
    r2Key: key,
  };
}

export async function uploadFile(
  buffer: Buffer,
  prefix: string,
  ext: string,
  contentType: string
): Promise<{ url: string; r2Key: string }> {
  const key = generateKey(prefix, ext);
  const client = getS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return {
    url: `${publicUrl()}/${key}`,
    r2Key: key,
  };
}

export async function deleteFile(r2Key: string): Promise<void> {
  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket(),
      Key: r2Key,
    })
  );
}
