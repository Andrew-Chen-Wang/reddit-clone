import path from "node:path"
import { fileURLToPath } from "node:url"
import { S3Client } from "@aws-sdk/client-s3"
import dotenv from "dotenv"

const currentDir = path.dirname(fileURLToPath(import.meta.url))

dotenv.config({ path: `${currentDir}/../../../../../.env`, quiet: true })

// forcePathStyle is required by Garage (the local/self-hosted S3 backend). `endpoint`
// stays undefined against real AWS, where the SDK resolves the region's endpoint itself.
export const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? "us-east-1",
  credentials:
    process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        }
      : undefined,
  forcePathStyle: true,
})

export function getS3BucketName(): string {
  const bucket = process.env.S3_BUCKET_NAME
  if (!bucket) throw new Error("S3_BUCKET_NAME is not set")
  return bucket
}

function getPublicMediaBaseUrl(): string {
  const base = process.env.PUBLIC_MEDIA_BASE_URL
  if (!base) throw new Error("PUBLIC_MEDIA_BASE_URL is not set")
  return base.endsWith("/") ? base.slice(0, -1) : base
}

export function publicMediaUrl(key: string): string {
  const trimmedKey = key.startsWith("/") ? key.slice(1) : key
  return `${getPublicMediaBaseUrl()}/${trimmedKey}`
}
