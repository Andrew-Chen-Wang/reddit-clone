import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

const commentSort = Type.Union([
  Type.Literal("best"),
  Type.Literal("top"),
  Type.Literal("new"),
  Type.Literal("old"),
  Type.Literal("controversial"),
])

export const commentTreeSchemaParam = Type.Object({
  postId: UUID7String,
})

export const commentTreeSchemaQuery = Type.Object({
  sort: Type.Optional(commentSort),
  parentId: Type.Optional(UUID7String),
  cursor: Type.Optional(Type.String()),
})

export const commentCreateSchemaRequest = Type.Object({
  postId: UUID7String,
  parentCommentId: Type.Optional(Nullable(UUID7String)),
  bodyMd: Type.String({ minLength: 1, maxLength: 10000 }),
})

export const commentUpdateSchemaRequest = Type.Object({
  bodyMd: Type.String({ minLength: 1, maxLength: 10000 }),
})

export const commentVoteSchemaParam = Type.Object({
  commentId: UUID7String,
})

export const commentVoteSchemaRequest = Type.Object({
  value: Type.Union([Type.Literal(-1), Type.Literal(0), Type.Literal(1)]),
})

export const commentVoteSchemaResponse = Type.Object({
  ups: Type.Number(),
  downs: Type.Number(),
  score: Type.Number(),
  userVote: Type.Number(),
})

export const commentCreateSchemaResponse = Type.Object({
  id: UUID7String,
})

export const commentNodeSchema = Type.Object({
  id: UUID7String,
  postId: UUID7String,
  parentCommentId: Nullable(UUID7String),
  depth: Type.Number(),
  path: Type.Array(UUID7String),
  bodyMd: Nullable(Type.String()),
  ups: Type.Number(),
  downs: Type.Number(),
  score: Type.Number(),
  childCount: Type.Number(),
  fetchedChildCount: Type.Number(),
  isSticky: Type.Boolean(),
  isDeleted: Type.Boolean(),
  removedByMod: Type.Boolean(),
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
      isAdmin: Type.Boolean(),
    }),
  ),
})

export const commentTreeSchemaResponse = Type.Object({
  data: Type.Array(commentNodeSchema),
  ancestors: Type.Array(commentNodeSchema),
  nextCursor: Nullable(Type.String()),
})
