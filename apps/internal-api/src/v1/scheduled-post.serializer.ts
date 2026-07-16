import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

const scheduledType = Type.Union([
  Type.Literal("text"),
  Type.Literal("link"),
  Type.Literal("media"),
])

const recurrence = Type.Union([
  Type.Literal("daily"),
  Type.Literal("weekly"),
  Type.Literal("monthly"),
])

export const scheduledPostCreateSchemaRequest = Type.Object({
  communityId: Type.Optional(Nullable(UUID7String)),
  isProfile: Type.Optional(Type.Boolean()),
  type: Type.Optional(scheduledType),
  title: Type.String({ minLength: 1, maxLength: 300 }),
  bodyMd: Type.Optional(Nullable(Type.String({ maxLength: 40000 }))),
  linkUrl: Type.Optional(Nullable(Type.String({ maxLength: 2000 }))),
  isNsfw: Type.Optional(Type.Boolean()),
  isSpoiler: Type.Optional(Type.Boolean()),
  isOc: Type.Optional(Type.Boolean()),
  flairTemplateId: Type.Optional(Nullable(UUID7String)),
  scheduledAt: Type.String({ format: "date-time" }),
  recurrence: Type.Optional(Nullable(recurrence)),
})

export const scheduledPostIdSchemaParam = Type.Object({
  id: UUID7String,
})

export const scheduledPostCommunitySchemaParam = Type.Object({
  communityId: UUID7String,
})

export const scheduledPostCreateSchemaResponse = Type.Object({
  id: UUID7String,
})

const scheduledPostSchema = Type.Object({
  id: UUID7String,
  authorUserId: UUID7String,
  communityId: Nullable(UUID7String),
  isProfile: Type.Boolean(),
  type: Type.String(),
  title: Type.String(),
  bodyMd: Nullable(Type.String()),
  linkUrl: Nullable(Type.String()),
  isNsfw: Type.Boolean(),
  isSpoiler: Type.Boolean(),
  isOc: Type.Boolean(),
  flairTemplateId: Nullable(UUID7String),
  scheduledAt: Type.String({ format: "date-time" }),
  recurrence: Nullable(Type.String()),
  status: Type.String(),
  publishedPostId: Nullable(UUID7String),
  createdAt: Type.String({ format: "date-time" }),
})

export const scheduledPostListSchemaResponse = Type.Object({
  data: Type.Array(scheduledPostSchema),
})
