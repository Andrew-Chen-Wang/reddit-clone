import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"
import { commentNodeSchema } from "./comment.serializer"
import { postCardSchema } from "./post.serializer"

const searchType = Type.Union([
  Type.Literal("posts"),
  Type.Literal("communities"),
  Type.Literal("comments"),
  Type.Literal("media"),
  Type.Literal("profiles"),
])

const searchSort = Type.Union([
  Type.Literal("relevance"),
  Type.Literal("hot"),
  Type.Literal("top"),
  Type.Literal("new"),
  Type.Literal("comments"),
])

const searchWindow = Type.Union([
  Type.Literal("hour"),
  Type.Literal("day"),
  Type.Literal("week"),
  Type.Literal("month"),
  Type.Literal("year"),
  Type.Literal("all"),
])

export const searchSchemaQuery = Type.Object({
  q: Type.String({ minLength: 1, maxLength: 300 }),
  type: Type.Optional(searchType),
  sort: Type.Optional(searchSort),
  t: Type.Optional(searchWindow),
  communityId: Type.Optional(UUID7String),
  authorUsername: Type.Optional(Type.String({ maxLength: 64 })),
  postId: Type.Optional(UUID7String),
  cursor: Type.Optional(Type.String()),
})

export const searchSuggestSchemaQuery = Type.Object({
  q: Type.String({ minLength: 1, maxLength: 128 }),
})

const communityCardSchema = Type.Object({
  id: UUID7String,
  name: Type.String(),
  displayName: Nullable(Type.String()),
  description: Type.String(),
  iconImageKey: Nullable(Type.String()),
  memberCount: Type.Number(),
  isNsfw: Type.Boolean(),
})

const profileCardSchema = Type.Object({
  id: UUID7String,
  username: Type.String(),
  displayName: Nullable(Type.String()),
  avatarImageKey: Nullable(Type.String()),
  about: Nullable(Type.String()),
  karma: Type.Number(),
})

const searchCommentSchema = Type.Object({
  comment: commentNodeSchema,
  postTitle: Type.String(),
  communityId: Nullable(UUID7String),
  communityName: Nullable(Type.String()),
})

export const searchSchemaResponse = Type.Object({
  type: searchType,
  total: Type.Number(),
  posts: Type.Array(postCardSchema),
  comments: Type.Array(searchCommentSchema),
  communities: Type.Array(communityCardSchema),
  profiles: Type.Array(profileCardSchema),
  nextCursor: Nullable(Type.String()),
})

export const searchSuggestSchemaResponse = Type.Object({
  communities: Type.Array(
    Type.Object({
      id: UUID7String,
      name: Type.String(),
      displayName: Nullable(Type.String()),
      memberCount: Type.Number(),
      isNsfw: Type.Boolean(),
    }),
  ),
  profiles: Type.Array(
    Type.Object({
      id: UUID7String,
      username: Type.String(),
      displayName: Nullable(Type.String()),
    }),
  ),
})
