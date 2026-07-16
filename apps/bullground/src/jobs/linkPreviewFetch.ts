import { randomUUID } from "node:crypto"
import { crudPost } from "@lib/dao/post/crud"
import { db } from "@template-nextjs/db"
import { getExtensionForImageContentType, isAllowedImageType, putObjectToS3 } from "@utils/aws"
import type { JobPayloadMap } from "@utils/queues"

const HTML_MAX_BYTES = 2 * 1024 * 1024
const IMAGE_MAX_BYTES = 10 * 1024 * 1024
const FETCH_TIMEOUT_MS = 10 * 1000
const USER_AGENT = "ReadItBot/1.0 (+link-preview)"

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/gi, "/")
}

function extractMetaImage(html: string): string | null {
  const metaRe = /<meta\s+[^>]*>/gi
  const metas = html.match(metaRe) ?? []
  for (const tag of metas) {
    const prop = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase()
    if (prop !== "og:image" && prop !== "og:image:url" && prop !== "twitter:image") continue
    const content = /content\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]
    if (content) return decodeEntities(content.trim())
  }
  return null
}

function firstJsonLdImage(node: unknown): string | null {
  if (node === null || node === undefined) return null
  if (typeof node === "string") return node
  if (Array.isArray(node)) {
    for (const entry of node) {
      const found = firstJsonLdImage(entry)
      if (found) return found
    }
    return null
  }
  if (typeof node === "object") {
    const record = node as Record<string, unknown>
    if ("image" in record) {
      const found = firstJsonLdImage(record.image)
      if (found) return found
    }
    if ("url" in record && typeof record.url === "string") return record.url
  }
  return null
}

function extractJsonLdImage(html: string): string | null {
  const blockRe = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null = blockRe.exec(html)
  while (match !== null) {
    const raw = match[1]?.trim()
    if (raw) {
      try {
        const found = firstJsonLdImage(JSON.parse(raw))
        if (found) return decodeEntities(found.trim())
      } catch {
        // Ignore malformed JSON-LD blocks and continue.
      }
    }
    match = blockRe.exec(html)
  }
  return null
}

async function fetchWithTimeout(url: string, accept: string): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT, accept },
    })
  } finally {
    clearTimeout(timeout)
  }
}

async function readCapped(res: Response, maxBytes: number): Promise<Uint8Array | null> {
  const buffer = new Uint8Array(await res.arrayBuffer())
  if (buffer.byteLength === 0 || buffer.byteLength > maxBytes) return null
  return buffer
}

async function extractImageUrl(pageUrl: string): Promise<string | null> {
  const res = await fetchWithTimeout(pageUrl, "text/html,application/xhtml+xml")
  if (!res.ok) return null
  const contentType = res.headers.get("content-type") ?? ""
  if (!contentType.includes("html")) return null
  const bytes = await readCapped(res, HTML_MAX_BYTES)
  if (!bytes) return null
  const html = new TextDecoder("utf-8").decode(bytes)
  const candidate = extractMetaImage(html) ?? extractJsonLdImage(html)
  if (!candidate) return null
  try {
    return new URL(candidate, pageUrl).toString()
  } catch {
    return null
  }
}

export async function processLinkPreviewFetch(
  data: JobPayloadMap["link-preview-fetch"],
): Promise<void> {
  const { postId, linkUrl } = data
  if (!isHttpUrl(linkUrl)) return

  let imageUrl: string | null
  try {
    imageUrl = await extractImageUrl(linkUrl)
  } catch (err: unknown) {
    console.warn(`[link-preview-fetch] failed to parse ${linkUrl}`, err)
    return
  }
  if (!imageUrl || !isHttpUrl(imageUrl)) return

  let res: Response
  try {
    res = await fetchWithTimeout(imageUrl, "image/*")
  } catch (err: unknown) {
    console.warn(`[link-preview-fetch] failed to download image ${imageUrl}`, err)
    return
  }
  if (!res.ok) return

  const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase()
  if (!isAllowedImageType(contentType)) return

  const ext = getExtensionForImageContentType(contentType)
  if (!ext) return

  const bytes = await readCapped(res, IMAGE_MAX_BYTES)
  if (!bytes) return

  const key = `link-preview/${postId}/${randomUUID()}.${ext}`
  try {
    await putObjectToS3(key, bytes, contentType)
  } catch (err: unknown) {
    console.error(`[link-preview-fetch] failed to upload ${key}`, err)
    return
  }

  await crudPost(db).setLinkImageKey(postId, key)
}
