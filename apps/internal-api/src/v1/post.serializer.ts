import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

const postType = Type.Union([Type.Literal("text"), Type.Literal("link"), Type.Literal("media")])

const postMediaInput = Type.Object({
  mediaType: Type.Union([Type.Literal("image"), Type.Literal("video")]),
  mimeType: Type.String({ minLength: 1, maxLength: 128 }),
  byteSize: Type.Number({ minimum: 0, multipleOf: 1 }),
  width: Type.Optional(Nullable(Type.Number({ minimum: 0, multipleOf: 1 }))),
  height: Type.Optional(Nullable(Type.Number({ minimum: 0, multipleOf: 1 }))),
})

export const postCreateSchemaRequest = Type.Object({
  communityId: Type.Optional(UUID7String),
  type: postType,
  title: Type.String({ minLength: 1, maxLength: 300 }),
  bodyMd: Type.Optional(Nullable(Type.String({ maxLength: 40000 }))),
  linkUrl: Type.Optional(Nullable(Type.String({ maxLength: 2000 }))),
  media: Type.Optional(Type.Array(postMediaInput, { minItems: 1, maxItems: 20 })),
  isNsfw: Type.Optional(Type.Boolean()),
  isSpoiler: Type.Optional(Type.Boolean()),
  isOc: Type.Optional(Type.Boolean()),
  flairTemplateId: Type.Optional(Nullable(UUID7String)),
  crosspostOfPostId: Type.Optional(Nullable(UUID7String)),
})

export const postUpdateSchemaRequest = Type.Object({
  bodyMd: Type.Optional(Type.String({ maxLength: 40000 })),
  isNsfw: Type.Optional(Type.Boolean()),
  isSpoiler: Type.Optional(Type.Boolean()),
  isOc: Type.Optional(Type.Boolean()),
  flairTemplateId: Type.Optional(Nullable(UUID7String)),
})

export const postCreateSchemaResponse = Type.Object({
  id: UUID7String,
  uploads: Type.Optional(
    Type.Array(
      Type.Object({
        position: Type.Number(),
        key: Type.String(),
        url: Type.String(),
        fields: Type.Record(Type.String(), Type.String()),
      }),
    ),
  ),
})

export const postCardSchema = Type.Object({
  id: UUID7String,
  type: Type.String(),
  title: Type.String(),
  slug: Nullable(Type.String()),
  bodyMd: Nullable(Type.String()),
  linkUrl: Nullable(Type.String()),
  linkImageUrl: Nullable(Type.String()),
  isNsfw: Type.Boolean(),
  isSpoiler: Type.Boolean(),
  isOc: Type.Boolean(),
  isLocked: Type.Boolean(),
  stickyPosition: Nullable(Type.Number()),
  ups: Type.Number(),
  downs: Type.Number(),
  score: Type.Number(),
  commentCount: Type.Number(),
  viewCount: Nullable(Type.Number()),
  shareCount: Type.Number(),
  createdAt: Type.String({ format: "date-time" }),
  editedAt: Nullable(Type.String({ format: "date-time" })),
  userVote: Type.Number(),
  isAuthor: Type.Boolean(),
  removed: Type.Optional(Type.Boolean()),
  removedByMod: Type.Optional(Type.Boolean()),
  removalReasonId: Type.Optional(Nullable(UUID7String)),
  author: Nullable(
    Type.Object({
      id: UUID7String,
      username: Type.String(),
      displayName: Nullable(Type.String()),
      avatarImageKey: Nullable(Type.String()),
      isAdmin: Type.Boolean(),
    }),
  ),
  crosspostOf: Nullable(
    Type.Object({
      id: UUID7String,
      title: Type.String(),
      score: Type.Number(),
      commentCount: Type.Number(),
      linkImageUrl: Nullable(Type.String()),
      community: Nullable(
        Type.Object({
          id: UUID7String,
          name: Type.String(),
        }),
      ),
      author: Nullable(
        Type.Object({
          id: UUID7String,
          username: Type.String(),
          displayName: Nullable(Type.String()),
        }),
      ),
    }),
  ),
  community: Nullable(
    Type.Object({
      id: UUID7String,
      name: Type.String(),
      displayName: Nullable(Type.String()),
      iconImageKey: Nullable(Type.String()),
      isNsfw: Type.Boolean(),
      isMember: Type.Boolean(),
    }),
  ),
  flair: Nullable(
    Type.Object({
      id: UUID7String,
      text: Type.String(),
      bgColor: Nullable(Type.String()),
      textColor: Nullable(Type.String()),
    }),
  ),
  media: Type.Array(
    Type.Object({
      mediaType: Type.String(),
      url: Type.String(),
      width: Nullable(Type.Number()),
      height: Nullable(Type.Number()),
    }),
  ),
})
