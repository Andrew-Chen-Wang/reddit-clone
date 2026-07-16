import { randomUUID } from "node:crypto"
import { getCommunityAuthz } from "@lib/dao/authz/community/get"
import { crudCommunity } from "@lib/dao/community/crud"
import { fetchPost } from "@lib/dao/post/fetch"
import { crudUser } from "@lib/dao/user/crud"
import { db } from "@template-nextjs/db"
import { createImageUploadPost, existsOnS3, getExtensionForImageContentType } from "@utils/aws"
import { promoteMediaCleanup } from "@utils/queues"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware } from "../middleware"
import { EmptyObject, ErrorSchemaResponse } from "../utils/common.serializer"
import { throwBadRequest, throwForbidden, throwNotFound } from "../utils/http-exception"
import {
  mediaAvatarUploadSchemaRequest,
  mediaBannerUploadSchemaRequest,
  mediaCommunityBannerUploadSchemaRequest,
  mediaCommunityConfirmSchemaRequest,
  mediaCommunityIconUploadSchemaRequest,
  mediaConfirmSchemaRequest,
  mediaKeyConfirmSchemaRequest,
  mediaUploadSchemaResponse,
} from "./media.serializer"

const AVATAR_MAX_BYTES = 5 * 1024 * 1024
const BANNER_MAX_BYTES = 10 * 1024 * 1024

const uploadResponse = {
  200: {
    description: "Presigned upload",
    content: { "application/json": { schema: resolver(mediaUploadSchemaResponse) } },
  },
  400: {
    description: "Invalid request",
    content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
  },
  403: {
    description: "Not permitted",
    content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
  },
}

const confirmResponse = {
  200: {
    description: "Confirmed",
    content: { "application/json": { schema: resolver(EmptyObject) } },
  },
  400: {
    description: "Invalid request",
    content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
  },
  403: {
    description: "Not permitted",
    content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
  },
  404: {
    description: "Not found",
    content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
  },
}

const app = new Hono()
  .use(authMiddleware)
  .post(
    "/confirm",
    describeRoute({
      description: "Confirm a media post's uploads finished, promoting its cleanup job",
      responses: confirmResponse,
    }),
    validator("json", mediaConfirmSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { postId } = c.req.valid("json")

      const post = await fetchPost(db).getOne(postId, ["authorUserId", "type"])
      if (!post) return throwNotFound(c, "Post not found")
      if (post.authorUserId !== user.id) return throwForbidden(c, "Not your post")
      if (post.type === "media") await promoteMediaCleanup(postId)

      return c.json({})
    },
  )
  .post(
    "/avatar-upload",
    describeRoute({
      description: "Presigned upload for the current user's avatar",
      responses: uploadResponse,
    }),
    validator("json", mediaAvatarUploadSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { mimeType } = c.req.valid("json")
      const ext = getExtensionForImageContentType(mimeType) ?? "bin"
      const key = `user-avatar/${user.id}/${randomUUID()}.${ext}`
      const presigned = await createImageUploadPost({
        key,
        contentType: mimeType,
        maxSizeBytes: AVATAR_MAX_BYTES,
      })
      return c.json({
        key: presigned.key,
        url: presigned.url,
        fields: presigned.fields,
        publicUrl: presigned.publicUrl,
      })
    },
  )
  .post(
    "/avatar-confirm",
    describeRoute({
      description: "Confirm an uploaded avatar and set it on the current user",
      responses: confirmResponse,
    }),
    validator("json", mediaKeyConfirmSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { key } = c.req.valid("json")
      if (!key.startsWith(`user-avatar/${user.id}/`)) {
        return throwBadRequest(c, "Invalid upload key", undefined, { target: "key" })
      }
      if (!(await existsOnS3(key))) {
        return throwBadRequest(c, "Uploaded file not found", undefined, { target: "key" })
      }
      await crudUser(db).updateUser(user.id, { avatarImageKey: key })
      return c.json({})
    },
  )
  .post(
    "/banner-upload",
    describeRoute({
      description: "Presigned upload for the current user's profile banner",
      responses: uploadResponse,
    }),
    validator("json", mediaBannerUploadSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { mimeType } = c.req.valid("json")
      const ext = getExtensionForImageContentType(mimeType) ?? "bin"
      const key = `user-banner/${user.id}/${randomUUID()}.${ext}`
      const presigned = await createImageUploadPost({
        key,
        contentType: mimeType,
        maxSizeBytes: BANNER_MAX_BYTES,
      })
      return c.json({
        key: presigned.key,
        url: presigned.url,
        fields: presigned.fields,
        publicUrl: presigned.publicUrl,
      })
    },
  )
  .post(
    "/banner-confirm",
    describeRoute({
      description: "Confirm an uploaded banner and set it on the current user",
      responses: confirmResponse,
    }),
    validator("json", mediaKeyConfirmSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { key } = c.req.valid("json")
      if (!key.startsWith(`user-banner/${user.id}/`)) {
        return throwBadRequest(c, "Invalid upload key", undefined, { target: "key" })
      }
      if (!(await existsOnS3(key))) {
        return throwBadRequest(c, "Uploaded file not found", undefined, { target: "key" })
      }
      await crudUser(db).updateUser(user.id, { bannerImageKey: key })
      return c.json({})
    },
  )
  .post(
    "/community-icon-upload",
    describeRoute({
      description: "Presigned upload for a community icon (mod config permission required)",
      responses: uploadResponse,
    }),
    validator("json", mediaCommunityIconUploadSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { communityId, mimeType } = c.req.valid("json")
      const mod = await getCommunityAuthz(db).canModerate(communityId, user.id, "config")
      if (!mod.ok) return throwForbidden(c, "You cannot configure this community")
      const ext = getExtensionForImageContentType(mimeType) ?? "bin"
      const key = `community-icon/${communityId}/${randomUUID()}.${ext}`
      const presigned = await createImageUploadPost({
        key,
        contentType: mimeType,
        maxSizeBytes: AVATAR_MAX_BYTES,
      })
      return c.json({
        key: presigned.key,
        url: presigned.url,
        fields: presigned.fields,
        publicUrl: presigned.publicUrl,
      })
    },
  )
  .post(
    "/community-icon-confirm",
    describeRoute({
      description: "Confirm an uploaded community icon (mod config permission required)",
      responses: confirmResponse,
    }),
    validator("json", mediaCommunityConfirmSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { communityId, key } = c.req.valid("json")
      const mod = await getCommunityAuthz(db).canModerate(communityId, user.id, "config")
      if (!mod.ok) return throwForbidden(c, "You cannot configure this community")
      if (!key.startsWith(`community-icon/${communityId}/`)) {
        return throwBadRequest(c, "Invalid upload key", undefined, { target: "key" })
      }
      if (!(await existsOnS3(key))) {
        return throwBadRequest(c, "Uploaded file not found", undefined, { target: "key" })
      }
      await crudCommunity(db).update(communityId, { iconImageKey: key })
      return c.json({})
    },
  )
  .post(
    "/community-banner-upload",
    describeRoute({
      description: "Presigned upload for a community banner (mod config permission required)",
      responses: uploadResponse,
    }),
    validator("json", mediaCommunityBannerUploadSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { communityId, mimeType } = c.req.valid("json")
      const mod = await getCommunityAuthz(db).canModerate(communityId, user.id, "config")
      if (!mod.ok) return throwForbidden(c, "You cannot configure this community")
      const ext = getExtensionForImageContentType(mimeType) ?? "bin"
      const key = `community-banner/${communityId}/${randomUUID()}.${ext}`
      const presigned = await createImageUploadPost({
        key,
        contentType: mimeType,
        maxSizeBytes: BANNER_MAX_BYTES,
      })
      return c.json({
        key: presigned.key,
        url: presigned.url,
        fields: presigned.fields,
        publicUrl: presigned.publicUrl,
      })
    },
  )
  .post(
    "/community-banner-confirm",
    describeRoute({
      description: "Confirm an uploaded community banner (mod config permission required)",
      responses: confirmResponse,
    }),
    validator("json", mediaCommunityConfirmSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { communityId, key } = c.req.valid("json")
      const mod = await getCommunityAuthz(db).canModerate(communityId, user.id, "config")
      if (!mod.ok) return throwForbidden(c, "You cannot configure this community")
      if (!key.startsWith(`community-banner/${communityId}/`)) {
        return throwBadRequest(c, "Invalid upload key", undefined, { target: "key" })
      }
      if (!(await existsOnS3(key))) {
        return throwBadRequest(c, "Uploaded file not found", undefined, { target: "key" })
      }
      await crudCommunity(db).update(communityId, { bannerImageKey: key })
      return c.json({})
    },
  )

export default app
