/**
 * Client-side helpers for the presigned media upload flow used by the submit
 * form and the avatar/banner/community-appearance croppers.
 *
 * Protocol: create the record (post or presigned endpoint) to get a target
 * `{ url, fields }`, POST a multipart form with every field appended BEFORE the
 * file (S3/Garage requires the file last), then call the matching confirm.
 */

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const
export const VIDEO_MIME_TYPES = ["video/mp4", "video/webm"] as const

export const IMAGE_MAX_BYTES = 20 * 1024 * 1024
export const VIDEO_MAX_BYTES = 200 * 1024 * 1024
export const MAX_MEDIA_FILES = 20

export type MediaDraftStatus = "idle" | "uploading" | "done" | "error"

export type MediaDraft = {
  id: string
  file: File
  previewUrl: string
  mediaType: "image" | "video"
  width: number | null
  height: number | null
  status: MediaDraftStatus
  progress: number
}

export type PresignedTarget = {
  url: string
  fields: Record<string, unknown>
}

function isImageMime(type: string): boolean {
  return (IMAGE_MIME_TYPES as readonly string[]).includes(type)
}

function isVideoMime(type: string): boolean {
  return (VIDEO_MIME_TYPES as readonly string[]).includes(type)
}

/** Validates a single file; returns an error message or null when acceptable. */
export function validateMediaFile(file: File): string | null {
  const image = isImageMime(file.type)
  const video = isVideoMime(file.type)
  if (!image && !video) {
    return `${file.name}: unsupported type. Use JPEG, PNG, GIF, WebP, MP4 or WebM.`
  }
  if (image && file.size > IMAGE_MAX_BYTES) {
    return `${file.name}: images must be 20MB or smaller.`
  }
  if (video && file.size > VIDEO_MAX_BYTES) {
    return `${file.name}: videos must be 200MB or smaller.`
  }
  return null
}

export function mediaTypeOf(file: File): "image" | "video" {
  return isVideoMime(file.type) ? "video" : "image"
}

/** Reads intrinsic pixel dimensions of an image; null for videos or on failure. */
export async function readImageDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  if (!isImageMime(file.type)) return null
  try {
    const bitmap = await createImageBitmap(file)
    const dims = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return dims
  } catch {
    return null
  }
}

/**
 * POSTs a file to a presigned S3/Garage target, reporting upload progress.
 * Resolves on a 2xx response, rejects otherwise.
 */
export function uploadToPresigned(
  target: PresignedTarget,
  file: File | Blob,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    for (const [key, value] of Object.entries(target.fields)) {
      form.append(key, String(value))
    }
    form.append("file", file)

    const xhr = new XMLHttpRequest()
    xhr.open("POST", target.url)
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    })
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new Error(`Upload failed (${xhr.status})`))
      }
    })
    xhr.addEventListener("error", () => {
      reject(new Error("Upload failed"))
    })
    xhr.send(form)
  })
}
