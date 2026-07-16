import { randomUUID } from "node:crypto"
import { getCommunityAuthz } from "@lib/dao/authz/community/get"
import { fetchCommunity } from "@lib/dao/community/fetch"
import { crudCommunityVisit } from "@lib/dao/communityVisit/crud"
import { crudPost } from "@lib/dao/post/crud"
import { fetchPost } from "@lib/dao/post/fetch"
import { processPosts } from "@lib/dao/post/processPost"
import { crudPostMedia } from "@lib/dao/postMedia/crud"
import { crudPostVote } from "@lib/dao/postVote/crud"
import { fetchPostFlairTemplate } from "@lib/dao/postFlairTemplate/fetch"
import { crudPostView } from "@lib/dao/postView/crud"
import { db } from "@template-nextjs/db"
import { createMediaUploadPost, getExtensionForMediaContentType } from "@utils/aws"
import { enqueueEsSyncPost, enqueueLinkPreviewFetch, enqueueMediaCleanup } from "@utils/queues"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware, authNoThrowMiddleware } from "../middleware"
import { EmptyObject, ErrorSchemaResponse, IdParamT } from "../utils/common.serializer"
import { throwBadRequest, throwForbidden, throwNotFound } from "../utils/http-exception"
import {
  postCardSchema,
  postCreateSchemaRequest,
  postCreateSchemaResponse,
  postUpdateSchemaRequest,
} from "./post.serializer"

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function hostnameOf(value: string): string | null {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "")
  } catch {
    return null
  }
}

function domainMatches(host: string, entry: string): boolean {
  const normalized = entry
    .toLowerCase()
    .replace(/^www\./, "")
    .trim()
  if (normalized.length === 0) return false
  return host === normalized || host.endsWith(`.${normalized}`)
}

function titleMatchesRegex(title: string, pattern: string): boolean {
  try {
    return new RegExp(pattern).test(title)
  } catch {
    return true
  }
}

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"])
const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm"])
const IMAGE_MAX_BYTES = 20 * 1024 * 1024
const VIDEO_MAX_BYTES = 200 * 1024 * 1024

interface MediaInput {
  mediaType: string
  mimeType: string
  byteSize: number
  width?: number | null
  height?: number | null
}

function validateMediaFile(file: MediaInput): string | null {
  if (file.mediaType === "image") {
    if (!IMAGE_MIME_TYPES.has(file.mimeType)) return `Unsupported image type: ${file.mimeType}`
    if (file.byteSize > IMAGE_MAX_BYTES) return "Images must be 20MB or smaller"
    return null
  }
  if (file.mediaType === "video") {
    if (!VIDEO_MIME_TYPES.has(file.mimeType)) return `Unsupported video type: ${file.mimeType}`
    if (file.byteSize > VIDEO_MAX_BYTES) return "Videos must be 200MB or smaller"
    return null
  }
  return `Unsupported media type: ${file.mediaType}`
}

const app = new Hono()
  .get(
    "/:id",
    authNoThrowMiddleware,
    describeRoute({
      description: "Get a single post with viewer overlay",
      responses: {
        200: {
          description: "Post",
          content: { "application/json": { schema: resolver(postCardSchema) } },
        },
        404: {
          description: "Post not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", IdParamT),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")

      const meta = await fetchPost(db).getOne(id, [
        "communityId",
        "profileUserId",
        "removedAt",
        "removedByUserId",
        "removalReasonId",
        "authorUserId",
      ])
      if (!meta) return throwNotFound(c, "Post not found")

      if (meta.communityId) {
        const view = await getCommunityAuthz(db).canView(meta.communityId, user?.id ?? null)
        if (!view.ok) return throwNotFound(c, "Post not found")
      }

      const isAuthor = meta.authorUserId === (user?.id ?? null)
      let isMod = false
      if (meta.removedAt && meta.communityId && user) {
        const mod = await getCommunityAuthz(db).canModerate(
          meta.communityId,
          user.id,
          "posts_comments",
        )
        isMod = mod.ok
      }

      const raw = await fetchPost(db).getRawById(id)
      if (!raw) return throwNotFound(c, "Post not found")

      const [processed] = await processPosts(db, [raw], user?.id ?? null)

      if (user) {
        await crudPostView(db).recordView(id, user.id)
        if (meta.communityId) await crudCommunityVisit(db).recordVisit(meta.communityId, user.id)
      } else {
        await crudPost(db).incrementViewCount(id)
      }

      if (meta.removedAt) {
        const removedByMod = meta.removedByUserId !== null
        if (isMod) {
          return c.json({
            ...processed,
            removed: true,
            removedByMod,
            removalReasonId: meta.removalReasonId,
          })
        }
        if (isAuthor) {
          return c.json({ ...processed, removed: true, removedByMod })
        }
        return c.json({
          ...processed,
          bodyMd: null,
          linkUrl: null,
          media: [],
          removed: true,
          removedByMod,
        })
      }

      return c.json(processed)
    },
  )
  .use(authMiddleware)
  .post(
    "/",
    describeRoute({
      description: "Create a text or link post",
      responses: {
        201: {
          description: "Post created",
          content: { "application/json": { schema: resolver(postCreateSchemaResponse) } },
        },
        400: {
          description: "Invalid request",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("json", postCreateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const body = c.req.valid("json")

      if (body.type === "link") {
        if (!body.linkUrl || !isValidHttpUrl(body.linkUrl)) {
          return throwBadRequest(c, "A valid http(s) link is required for link posts", undefined, {
            target: "linkUrl",
          })
        }
      }

      if (body.type === "media") {
        if (!body.media || body.media.length === 0) {
          return throwBadRequest(
            c,
            "At least one media file is required for media posts",
            undefined,
            { target: "media" },
          )
        }
        for (const file of body.media) {
          const err = validateMediaFile(file)
          if (err) return throwBadRequest(c, err, undefined, { target: "media" })
        }
      }

      let holdForReview = false
      if (body.communityId) {
        const canPost = await getCommunityAuthz(db).canPost(body.communityId, user.id)
        if (!canPost.ok) {
          if (canPost.reason === "BANNED") {
            return throwForbidden(c, "You are banned from this community")
          }
          return throwForbidden(c, "You cannot post in this community")
        }

        const settings = await fetchCommunity(db).getOne(body.communityId, [
          "allowedPostTypes",
          "bodyPolicy",
          "titleRegex",
          "linkDomainWhitelist",
          "linkDomainBlacklist",
          "requirePostFlair",
          "spoilerEnabled",
          "holdForReview",
        ])
        if (settings) {
          holdForReview = settings.holdForReview
          if (settings.allowedPostTypes === "text_only" && body.type !== "text") {
            return throwBadRequest(c, "This community only allows text posts", undefined, {
              target: "type",
            })
          }
          if (settings.allowedPostTypes === "links_only" && body.type === "text") {
            return throwBadRequest(c, "This community does not allow text posts", undefined, {
              target: "type",
            })
          }
          if (settings.bodyPolicy === "required" && body.type === "text") {
            const trimmed = (body.bodyMd ?? "").trim()
            if (trimmed.length === 0) {
              return throwBadRequest(c, "This community requires a post body", undefined, {
                target: "bodyMd",
              })
            }
          }
          if (settings.titleRegex && !titleMatchesRegex(body.title, settings.titleRegex)) {
            return throwBadRequest(
              c,
              "Your title does not meet this community's rules",
              undefined,
              {
                target: "title",
              },
            )
          }
          if (body.type === "link" && body.linkUrl) {
            const host = hostnameOf(body.linkUrl)
            const whitelist = settings.linkDomainWhitelist ?? []
            const blacklist = settings.linkDomainBlacklist ?? []
            if (host && whitelist.length > 0 && !whitelist.some((d) => domainMatches(host, d))) {
              return throwBadRequest(c, "Links from this domain are not allowed", undefined, {
                target: "linkUrl",
              })
            }
            if (host && blacklist.some((d) => domainMatches(host, d))) {
              return throwBadRequest(c, "Links from this domain are not allowed", undefined, {
                target: "linkUrl",
              })
            }
          }
          if (!settings.spoilerEnabled && body.isSpoiler) {
            return throwBadRequest(c, "Spoiler tags are disabled in this community", undefined, {
              target: "isSpoiler",
            })
          }
          if (settings.requirePostFlair && !body.flairTemplateId) {
            return throwBadRequest(c, "This community requires post flair", undefined, {
              target: "flairTemplateId",
            })
          }
        }

        if (body.flairTemplateId) {
          const flair = await fetchPostFlairTemplate(db).getOne(body.flairTemplateId, [
            "communityId",
            "modOnly",
          ])
          if (!flair || flair.communityId !== body.communityId) {
            return throwBadRequest(c, "Invalid flair for this community", undefined, {
              target: "flairTemplateId",
            })
          }
          if (flair.modOnly) {
            const mod = await getCommunityAuthz(db).canModerate(body.communityId, user.id, "flair")
            if (!mod.ok) return throwForbidden(c, "This flair is restricted to moderators")
          }
        }
      } else if (body.flairTemplateId) {
        return throwBadRequest(c, "Profile posts cannot have community flair", undefined, {
          target: "flairTemplateId",
        })
      }

      if (body.crosspostOfPostId) {
        const source = await fetchPost(db).getOne(body.crosspostOfPostId, [
          "id",
          "removedAt",
          "communityId",
        ])
        if (!source || source.removedAt) {
          return throwNotFound(c, "Original post not found")
        }
      }

      const created = await crudPost(db).create({
        authorUserId: user.id,
        communityId: body.communityId ?? null,
        profileUserId: body.communityId ? null : user.id,
        type: body.type,
        title: body.title,
        bodyMd: body.type === "text" ? (body.bodyMd ?? null) : null,
        linkUrl: body.type === "link" ? (body.linkUrl ?? null) : null,
        isNsfw: body.isNsfw ?? false,
        isSpoiler: body.isSpoiler ?? false,
        isOc: body.isOc ?? false,
        flairTemplateId: body.communityId ? (body.flairTemplateId ?? null) : null,
        crosspostOfPostId: body.crosspostOfPostId ?? null,
      })

      await crudPostVote(db).setVote(created.id, user.id, 1)

      if (holdForReview) await crudPost(db).hold(created.id)

      await enqueueEsSyncPost(created.id)

      if (body.type === "link" && body.linkUrl) {
        await enqueueLinkPreviewFetch(created.id, body.linkUrl)
      }

      if (body.type === "media" && body.media) {
        const items = body.media.map((file, i) => {
          const ext = getExtensionForMediaContentType(file.mimeType) ?? "bin"
          return {
            position: i,
            mediaType: file.mediaType,
            s3Key: `post-media/${created.id}/${i}-${randomUUID()}.${ext}`,
            mimeType: file.mimeType,
            byteSize: file.byteSize,
            width: file.width ?? null,
            height: file.height ?? null,
          }
        })
        await crudPostMedia(db).createMany(created.id, items)
        const uploads = await Promise.all(
          items.map(async (item) => {
            const maxSizeBytes = item.mediaType === "image" ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES
            const presigned = await createMediaUploadPost({
              key: item.s3Key,
              contentType: item.mimeType,
              maxSizeBytes,
            })
            return {
              position: item.position,
              key: item.s3Key,
              url: presigned.url,
              fields: presigned.fields,
            }
          }),
        )
        await enqueueMediaCleanup(created.id)
        return c.json({ id: created.id, uploads }, 201)
      }

      return c.json({ id: created.id }, 201)
    },
  )
  .patch(
    "/:id",
    describeRoute({
      description: "Edit a post (author only)",
      responses: {
        200: {
          description: "Post updated",
          content: { "application/json": { schema: resolver(postCreateSchemaResponse) } },
        },
        400: {
          description: "Invalid request",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        403: {
          description: "Not the author",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Post not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", IdParamT),
    validator("json", postUpdateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")
      const body = c.req.valid("json")

      const meta = await fetchPost(db).getOne(id, ["authorUserId", "type", "communityId"])
      if (!meta) return throwNotFound(c, "Post not found")
      if (meta.authorUserId !== user.id) return throwForbidden(c, "You cannot edit this post")

      if (body.bodyMd !== undefined && meta.type !== "text") {
        return throwBadRequest(c, "Only text posts can edit their body")
      }

      if (body.flairTemplateId) {
        if (!meta.communityId) {
          return throwBadRequest(c, "Profile posts cannot have community flair", undefined, {
            target: "flairTemplateId",
          })
        }
        const flair = await fetchPostFlairTemplate(db).getOne(body.flairTemplateId, [
          "communityId",
          "modOnly",
        ])
        if (!flair || flair.communityId !== meta.communityId) {
          return throwBadRequest(c, "Invalid flair for this community", undefined, {
            target: "flairTemplateId",
          })
        }
        if (flair.modOnly) {
          const mod = await getCommunityAuthz(db).canModerate(meta.communityId, user.id, "flair")
          if (!mod.ok) return throwForbidden(c, "This flair is restricted to moderators")
        }
      }

      const updated = await crudPost(db).update(id, user.id, body)
      if (!updated) return throwNotFound(c, "Post not found")

      await enqueueEsSyncPost(updated.id)

      return c.json({ id: updated.id })
    },
  )
  .delete(
    "/:id",
    describeRoute({
      description: "Delete a post (author only)",
      responses: {
        200: {
          description: "Post deleted",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        404: {
          description: "Post not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", IdParamT),
    async (c) => {
      const user = c.var.user
      const { id } = c.req.valid("param")

      const deleted = await crudPost(db).deleteOwn(id, user.id)
      if (!deleted) return throwNotFound(c, "Post not found")

      await enqueueEsSyncPost(id)

      return c.json({})
    },
  )

export default app
