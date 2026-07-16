import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

export const adminPostSchemaQuery = Type.Object({
  q: Type.Optional(Type.String()),
  cursor: Type.Optional(Type.String()),
})

export const adminPostSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      id: UUID7String,
      title: Type.String(),
      communityId: Nullable(UUID7String),
      communityName: Nullable(Type.String()),
      authorUsername: Nullable(Type.String()),
      score: Type.Number(),
      removedAt: Nullable(Type.String({ format: "date-time" })),
      createdAt: Type.String({ format: "date-time" }),
    }),
  ),
  nextCursor: Nullable(Type.String()),
})
