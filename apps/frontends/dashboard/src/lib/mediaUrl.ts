import { buildMediaUrl } from "@ui/seo-shared/media/mediaUrl"

/**
 * Public base URL for stored media, resolved from the SPA build env. Defaults to
 * the local Garage/S3 endpoint used by `docker-compose` + the root `.env`
 * (`PUBLIC_MEDIA_BASE_URL=http://readit-media.web.garage.localhost:21693`).
 */
const MEDIA_BASE_URL =
  (import.meta.env.VITE_PUBLIC_MEDIA_BASE_URL as string | undefined) ??
  "http://readit-media.web.garage.localhost:21693"

/** SPA-bound convenience wrapper around {@link buildMediaUrl}. */
export function mediaUrl(key: string | null | undefined): string | null {
  return buildMediaUrl(key, MEDIA_BASE_URL)
}
