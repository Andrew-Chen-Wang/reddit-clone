import { createPresignedPost } from "@aws-sdk/s3-presigned-post"
import { getS3BucketName, publicMediaUrl, s3Client } from "./client"

const IMAGE_CONTENT_TYPE_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
}

const IMAGE_MAX_BYTES = 20 * 1024 * 1024
const VIDEO_MAX_BYTES = 1024 * 1024 * 1024

const MEDIA_CONTENT_TYPE_TO_EXT: Record<string, string> = {
  ...IMAGE_CONTENT_TYPE_TO_EXT,
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
}

const MEDIA_CONTENT_TYPE_TO_MAX_BYTES: Record<string, number> = {
  "image/png": IMAGE_MAX_BYTES,
  "image/jpeg": IMAGE_MAX_BYTES,
  "image/gif": IMAGE_MAX_BYTES,
  "image/webp": IMAGE_MAX_BYTES,
  "video/mp4": VIDEO_MAX_BYTES,
  "video/quicktime": VIDEO_MAX_BYTES,
  "video/webm": VIDEO_MAX_BYTES,
}

const UPLOAD_EXPIRY_SECONDS = 30 * 60

export function getExtensionForImageContentType(contentType: string): string | undefined {
  return IMAGE_CONTENT_TYPE_TO_EXT[contentType]
}

export function isAllowedImageType(contentType: string): boolean {
  return contentType in IMAGE_CONTENT_TYPE_TO_EXT
}

export function getExtensionForMediaContentType(contentType: string): string | undefined {
  return MEDIA_CONTENT_TYPE_TO_EXT[contentType]
}

export function isAllowedMediaType(contentType: string): boolean {
  return contentType in MEDIA_CONTENT_TYPE_TO_MAX_BYTES
}

export function getMediaMaxSize(contentType: string): number | undefined {
  return MEDIA_CONTENT_TYPE_TO_MAX_BYTES[contentType]
}

export interface PresignedUploadPost {
  url: string
  fields: Record<string, string>
  key: string
  publicUrl: string
}

async function createUploadPost(
  key: string,
  contentType: string,
  maxSizeBytes: number,
): Promise<PresignedUploadPost> {
  const Bucket = getS3BucketName()
  const { url, fields } = await createPresignedPost(s3Client, {
    Bucket,
    Key: key,
    Conditions: [
      ["content-length-range", 0, maxSizeBytes],
      ["eq", "$Content-Type", contentType],
    ],
    Fields: {
      "Content-Type": contentType,
    },
    Expires: UPLOAD_EXPIRY_SECONDS,
  })

  return { url, fields, key, publicUrl: publicMediaUrl(key) }
}

export async function createImageUploadPost(params: {
  key: string
  contentType: string
  maxSizeBytes?: number
}): Promise<PresignedUploadPost> {
  if (!isAllowedImageType(params.contentType)) {
    throw new Error(`Unsupported image content type: ${params.contentType}`)
  }
  return createUploadPost(params.key, params.contentType, params.maxSizeBytes ?? IMAGE_MAX_BYTES)
}

export async function createMediaUploadPost(params: {
  key: string
  contentType: string
  maxSizeBytes?: number
}): Promise<PresignedUploadPost> {
  const defaultMax = getMediaMaxSize(params.contentType)
  if (defaultMax === undefined) {
    throw new Error(`Unsupported media content type: ${params.contentType}`)
  }
  return createUploadPost(params.key, params.contentType, params.maxSizeBytes ?? defaultMax)
}
