import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"
import { commentNodeSchema } from "./comment.serializer"
import { postCardSchema } from "./post.serializer"

const queueTab = Type.Union([
  Type.Literal("needs_review"),
  Type.Literal("reported"),
  Type.Literal("removed"),
  Type.Literal("edited"),
  Type.Literal("unmoderated"),
])

export const modQueueCommunityParam = Type.Object({
  communityId: Type.String(),
})

export const modQueueSchemaQuery = Type.Object({
  tab: Type.Optional(queueTab),
  cursor: Type.Optional(Type.String()),
})

export const modQueueSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      targetType: Type.Union([Type.Literal("post"), Type.Literal("comment")]),
      communityId: UUID7String,
      post: Nullable(postCardSchema),
      comment: Nullable(commentNodeSchema),
      reportCount: Type.Number(),
      reasons: Type.Array(
        Type.Object({
          communityRuleId: Nullable(UUID7String),
          reasonText: Nullable(Type.String()),
        }),
      ),
      removed: Type.Boolean(),
      removedByMod: Type.Boolean(),
      held: Type.Boolean(),
      isSpam: Type.Boolean(),
      approved: Type.Boolean(),
      removalReasonId: Nullable(UUID7String),
      createdAt: Type.String({ format: "date-time" }),
    }),
  ),
  nextCursor: Nullable(Type.String()),
})

export const modQueueApproveSchemaRequest = Type.Object({
  postId: Type.Optional(UUID7String),
  commentId: Type.Optional(UUID7String),
})

export const modQueueRemoveSchemaRequest = Type.Object({
  postId: Type.Optional(UUID7String),
  commentId: Type.Optional(UUID7String),
  removalReasonId: Type.Optional(Nullable(UUID7String)),
  asSpam: Type.Optional(Type.Boolean()),
})

export const modQueueLockSchemaRequest = Type.Object({
  postId: UUID7String,
})

export const modQueueStickySchemaRequest = Type.Object({
  postId: UUID7String,
  position: Nullable(Type.Union([Type.Literal(1), Type.Literal(2)])),
})

export const modQueueStickyCommentSchemaRequest = Type.Object({
  commentId: UUID7String,
  sticky: Type.Boolean(),
})
