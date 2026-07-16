import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

export const modLogCommunityParam = Type.Object({
  communityId: UUID7String,
})

export const modLogSchemaQuery = Type.Object({
  cursor: Type.Optional(Type.String()),
})

export const modLogSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      id: UUID7String,
      action: Type.String(),
      details: Nullable(Type.Object({}, { additionalProperties: true })),
      createdAt: Type.String({ format: "date-time" }),
      modUserId: Nullable(UUID7String),
      modUsername: Nullable(Type.String()),
      targetPostId: Nullable(UUID7String),
      targetPostTitle: Nullable(Type.String()),
      targetCommentId: Nullable(UUID7String),
      targetUserId: Nullable(UUID7String),
      targetUsername: Nullable(Type.String()),
    }),
  ),
  nextCursor: Nullable(Type.String()),
})
