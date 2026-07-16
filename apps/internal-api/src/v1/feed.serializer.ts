import { Type } from "typebox"
import { postCardSchema } from "./post.serializer"

const feedSort = Type.Union([
  Type.Literal("hot"),
  Type.Literal("new"),
  Type.Literal("top"),
  Type.Literal("controversial"),
  Type.Literal("rising"),
])

const homeSort = Type.Union([
  Type.Literal("best"),
  Type.Literal("hot"),
  Type.Literal("new"),
  Type.Literal("top"),
  Type.Literal("rising"),
])

const topWindow = Type.Union([
  Type.Literal("hour"),
  Type.Literal("day"),
  Type.Literal("week"),
  Type.Literal("month"),
  Type.Literal("year"),
  Type.Literal("all"),
])

export const feedSchemaQuery = Type.Object({
  sort: Type.Optional(feedSort),
  t: Type.Optional(topWindow),
  cursor: Type.Optional(Type.String()),
  flairTemplateId: Type.Optional(Type.String()),
})

export const homeFeedSchemaQuery = Type.Object({
  sort: Type.Optional(homeSort),
  t: Type.Optional(topWindow),
  cursor: Type.Optional(Type.String()),
})

export const feedNameSchemaParam = Type.Object({
  name: Type.String(),
})

export const feedUsernameSchemaParam = Type.Object({
  username: Type.String(),
})

export const feedSchemaResponse = Type.Object({
  data: Type.Array(postCardSchema),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
})
