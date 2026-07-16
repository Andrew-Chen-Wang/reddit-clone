import { randomUUID } from "node:crypto"
import { getCommunityAuthz } from "@lib/dao/authz/community/get"
import { crudCommunityVisit } from "@lib/dao/communityVisit/crud"
import { crudPost } from "@lib/dao/post/crud"
import { fetchPost } from "@lib/dao/post/fetch"
import { processPosts } from "@lib/dao/post/processPost"
import { crudPostMedia } from "@lib/dao/postMedia/crud"
import { fetchPostFlairTemplate } from "@lib/dao/postFlairTemplate/fetch"
import { crudPostView } from "@lib/dao/postView/crud"
import { db } from "@template-nextjs/db"
import { createMediaUploadPost, getExtensionForMediaContentType } from "@utils/aws"
import { enqueueMediaCleanup } from "@utils/queues"
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
        "authorUserId",
      ])
      if (!meta) return throwNotFound(c, "Post not found")

      if (meta.communityId) {
        const view = await getCommunityAuthz(db).canView(meta.communityId, user?.id ?? null)
        if (!view.ok) return throwNotFound(c, "Post not found")
      }
      if (meta.removedAt && meta.authorUserId !== (user?.id ?? null)) {
        return throwNotFound(c, "Post not found")
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

      if (body.communityId) {
        const canPost = await getCommunityAuthz(db).canPost(body.communityId, user.id)
        if (!canPost.ok) return throwForbidden(c, "You cannot post in this community")

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
      })

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

      return c.json({})
    },
  )

export default app
