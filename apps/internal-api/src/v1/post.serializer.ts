import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

const postType = Type.Union([Type.Literal("text"), Type.Literal("link")])

export const postCreateSchemaRequest = Type.Object({
  communityId: Type.Optional(UUID7String),
  type: postType,
  title: Type.String({ minLength: 1, maxLength: 300 }),
  bodyMd: Type.Optional(Nullable(Type.String({ maxLength: 40000 }))),
  linkUrl: Type.Optional(Nullable(Type.String({ maxLength: 2000 }))),
  isNsfw: Type.Optional(Type.Boolean()),
  isSpoiler: Type.Optional(Type.Boolean()),
  isOc: Type.Optional(Type.Boolean()),
  flairTemplateId: Type.Optional(Nullable(UUID7String)),
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
})

export const postCardSchema = Type.Object({
  id: UUID7String,
  type: Type.String(),
  title: Type.String(),
  bodyMd: Nullable(Type.String()),
  linkUrl: Nullable(Type.String()),
  isNsfw: Type.Boolean(),
  isSpoiler: Type.Boolean(),
  isOc: Type.Boolean(),
  isLocked: Type.Boolean(),
  stickyPosition: Nullable(Type.Number()),
  ups: Type.Number(),
  downs: Type.Number(),
  score: Type.Number(),
  commentCount: Type.Number(),
  viewCount: Type.Number(),
  shareCount: Type.Number(),
  createdAt: Type.String({ format: "date-time" }),
  editedAt: Nullable(Type.String({ format: "date-time" })),
  userVote: Type.Number(),
  isAuthor: Type.Boolean(),
  author: Nullable(
    Type.Object({
      id: UUID7String,
      username: Type.String(),
      displayName: Nullable(Type.String()),
      avatarImageKey: Nullable(Type.String()),
    }),
  ),
  community: Nullable(
    Type.Object({
      id: UUID7String,
      name: Type.String(),
      displayName: Nullable(Type.String()),
      iconImageKey: Nullable(Type.String()),
      isNsfw: Type.Boolean(),
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
})
