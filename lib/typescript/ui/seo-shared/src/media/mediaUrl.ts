/**
 * Builds a public media URL from a stored object key.
 *
 * Media is stored under keys like `community-icon/<id>/<uuid>.png`. The display
 * side needs to prefix those keys with the public bucket base URL. Post media is
 * already URL-ized server-side, so this is idempotent: values that are already
 * absolute (http/https) are returned unchanged. Framework-agnostic — the caller
 * supplies `base` (Vite reads `import.meta.env`, Next.js reads `process.env`).
 */
export function buildMediaUrl(key: string | null | undefined, base: string): string | null {
  if (!key) return null
  if (/^https?:\/\//i.test(key)) return key
  const trimmedBase = base.replace(/\/+$/, "")
  const trimmedKey = key.replace(/^\/+/, "")
  return `${trimmedBase}/${trimmedKey}`
}
