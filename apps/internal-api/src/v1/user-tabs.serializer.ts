import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"
import { postCardSchema } from "./post.serializer"

export const savedTabSchemaQuery = Type.Object({
  type: Type.Optional(Type.Union([Type.Literal("posts"), Type.Literal("comments")])),
  cursor: Type.Optional(Type.String()),
})

export const postTabSchemaQuery = Type.Object({
  cursor: Type.Optional(Type.String()),
})

export const commentWithPostSchema = Type.Object({
  id: UUID7String,
  postId: UUID7String,
  parentCommentId: Nullable(UUID7String),
  depth: Type.Number(),
  bodyMd: Nullable(Type.String()),
  ups: Type.Number(),
  downs: Type.Number(),
  score: Type.Number(),
  isDeleted: Type.Boolean(),
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
  post: Type.Object({
    id: UUID7String,
    title: Type.String(),
    community: Nullable(
      Type.Object({
        id: UUID7String,
        name: Type.String(),
      }),
    ),
  }),
})

export const savedTabSchemaResponse = Type.Object({
  posts: Type.Array(postCardSchema),
  comments: Type.Array(commentWithPostSchema),
  nextCursor: Nullable(Type.String()),
})

export const commentTabSchemaResponse = Type.Object({
  data: Type.Array(commentWithPostSchema),
  nextCursor: Nullable(Type.String()),
})

export const overviewSchemaQuery = Type.Object({
  cursor: Type.Optional(Type.String()),
})

export const overviewItemSchema = Type.Union([
  Type.Object({
    kind: Type.Literal("post"),
    post: postCardSchema,
  }),
  Type.Object({
    kind: Type.Literal("comment"),
    comment: commentWithPostSchema,
  }),
])

export const overviewSchemaResponse = Type.Object({
  data: Type.Array(overviewItemSchema),
  nextCursor: Nullable(Type.String()),
})
