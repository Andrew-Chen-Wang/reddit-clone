import { buildMediaUrl } from "@ui/seo-shared/media/mediaUrl"

/**
 * Public base URL for stored media on the server. `PUBLIC_MEDIA_BASE_URL` is read
 * at request time (SSR only); defaults to the local Garage/S3 endpoint.
 */
const MEDIA_BASE_URL =
  process.env.PUBLIC_MEDIA_BASE_URL ?? "http://readit-media.web.garage.localhost:21693"

/** Server-bound convenience wrapper around {@link buildMediaUrl}. */
export function mediaUrl(key: string | null | undefined): string | null {
  return buildMediaUrl(key, MEDIA_BASE_URL)
}
