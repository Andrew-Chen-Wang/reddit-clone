import { Type } from "typebox"
import { UUID7String } from "../utils/common.serializer"

const imageMimeType = Type.Union([
  Type.Literal("image/jpeg"),
  Type.Literal("image/png"),
  Type.Literal("image/gif"),
  Type.Literal("image/webp"),
])

const AVATAR_MAX_BYTES = 5 * 1024 * 1024
const BANNER_MAX_BYTES = 10 * 1024 * 1024

export const mediaConfirmSchemaRequest = Type.Object({
  postId: UUID7String,
})

export const mediaAvatarUploadSchemaRequest = Type.Object({
  mimeType: imageMimeType,
  byteSize: Type.Number({ minimum: 0, multipleOf: 1, maximum: AVATAR_MAX_BYTES }),
})

export const mediaBannerUploadSchemaRequest = Type.Object({
  mimeType: imageMimeType,
  byteSize: Type.Number({ minimum: 0, multipleOf: 1, maximum: BANNER_MAX_BYTES }),
})

export const mediaKeyConfirmSchemaRequest = Type.Object({
  key: Type.String({ minLength: 1, maxLength: 512 }),
})

export const mediaCommunityIconUploadSchemaRequest = Type.Object({
  communityId: UUID7String,
  mimeType: imageMimeType,
  byteSize: Type.Number({ minimum: 0, multipleOf: 1, maximum: AVATAR_MAX_BYTES }),
})

export const mediaCommunityBannerUploadSchemaRequest = Type.Object({
  communityId: UUID7String,
  mimeType: imageMimeType,
  byteSize: Type.Number({ minimum: 0, multipleOf: 1, maximum: BANNER_MAX_BYTES }),
})

export const mediaCommunityConfirmSchemaRequest = Type.Object({
  communityId: UUID7String,
  key: Type.String({ minLength: 1, maxLength: 512 }),
})

export const mediaUploadSchemaResponse = Type.Object({
  key: Type.String(),
  url: Type.String(),
  fields: Type.Record(Type.String(), Type.String()),
  publicUrl: Type.String(),
})
