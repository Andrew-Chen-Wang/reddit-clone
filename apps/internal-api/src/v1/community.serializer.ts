import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

const visibility = Type.Union([
  Type.Literal("public"),
  Type.Literal("restricted"),
  Type.Literal("private"),
])

const commentSort = Type.Union([
  Type.Literal("best"),
  Type.Literal("top"),
  Type.Literal("new"),
  Type.Literal("controversial"),
  Type.Literal("old"),
])

const notificationLevel = Type.Union([
  Type.Literal("off"),
  Type.Literal("low"),
  Type.Literal("frequent"),
])

export const communityCreateSchemaRequest = Type.Object({
  name: Type.String({ minLength: 3, maxLength: 21, pattern: "^[A-Za-z0-9_]+$" }),
  displayName: Type.Optional(Nullable(Type.String({ maxLength: 100 }))),
  description: Type.String({ minLength: 1, maxLength: 500 }),
  visibility: Type.Optional(visibility),
  isNsfw: Type.Optional(Type.Boolean()),
  topicId: Type.Optional(Nullable(UUID7String)),
})

export const communityUpdateSchemaRequest = Type.Object({
  displayName: Type.Optional(Nullable(Type.String({ maxLength: 100 }))),
  description: Type.Optional(Type.String({ minLength: 1, maxLength: 500 })),
  defaultCommentSort: Type.Optional(commentSort),
  topicId: Type.Optional(Nullable(UUID7String)),
  isNsfw: Type.Optional(Type.Boolean()),
})

export const communityNameSchemaParam = Type.Object({
  name: Type.String(),
})

export const communityNameAvailableSchemaQuery = Type.Object({
  name: Type.String({ minLength: 3, maxLength: 21, pattern: "^[A-Za-z0-9_]+$" }),
})

export const communityNameAvailableSchemaResponse = Type.Object({
  available: Type.Boolean(),
})

export const communityCreateSchemaResponse = Type.Object({
  id: UUID7String,
  name: Type.String(),
})

export const communityDetailSchemaResponse = Type.Object({
  id: UUID7String,
  name: Type.String(),
  displayName: Nullable(Type.String()),
  description: Type.String(),
  visibility: Type.String(),
  isNsfw: Type.Boolean(),
  topicId: Nullable(UUID7String),
  iconImageKey: Nullable(Type.String()),
  bannerImageKey: Nullable(Type.String()),
  memberCount: Type.Number(),
  defaultCommentSort: Type.String(),
  createdAt: Type.String({ format: "date-time" }),
  rules: Type.Array(
    Type.Object({
      id: UUID7String,
      name: Type.String(),
      description: Nullable(Type.String()),
      position: Type.Number(),
    }),
  ),
  moderators: Type.Array(
    Type.Object({
      userId: UUID7String,
      username: Type.String(),
      avatarImageKey: Nullable(Type.String()),
      position: Type.Number(),
    }),
  ),
  viewer: Type.Object({
    isMember: Type.Boolean(),
    isFavorite: Type.Boolean(),
    isModerator: Type.Boolean(),
    notificationLevel: Nullable(notificationLevel),
    pendingJoinRequest: Type.Boolean(),
  }),
})
