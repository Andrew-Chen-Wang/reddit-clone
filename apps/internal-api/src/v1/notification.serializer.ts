import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

const notificationLevel = Type.Union([
  Type.Literal("off"),
  Type.Literal("inbox"),
  Type.Literal("all"),
])

export const notificationListSchemaQuery = Type.Object({
  cursor: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Number({ minimum: 0, multipleOf: 1 })),
})

const previewSnapshotSchema = Type.Object({
  title: Type.Optional(Nullable(Type.String())),
  body: Type.Optional(Nullable(Type.String())),
  communityName: Type.Optional(Nullable(Type.String())),
  actorUsername: Type.Optional(Nullable(Type.String())),
  postId: Type.Optional(Nullable(Type.String())),
  commentId: Type.Optional(Nullable(Type.String())),
  url: Type.Optional(Nullable(Type.String())),
  count: Type.Optional(Nullable(Type.Number())),
})

export const notificationListSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      id: UUID7String,
      type: Type.String(),
      actorUserId: Nullable(UUID7String),
      postId: Nullable(UUID7String),
      commentId: Nullable(UUID7String),
      communityId: Nullable(UUID7String),
      conversationId: Nullable(UUID7String),
      previewSnapshot: Nullable(previewSnapshotSchema),
      isRead: Type.Boolean(),
      createdAt: Type.String({ format: "date-time" }),
    }),
  ),
  nextCursor: Nullable(Type.String()),
})

export const notificationUnreadCountSchemaResponse = Type.Object({
  count: Type.Number(),
})

export const notificationPreferencesSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      type: Type.String(),
      level: notificationLevel,
    }),
  ),
})

export const notificationPreferenceUpdateSchemaRequest = Type.Object({
  type: Type.String({ minLength: 1, maxLength: 64 }),
  level: notificationLevel,
})
