import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

export const adminUserSchemaQuery = Type.Object({
  q: Type.Optional(Type.String()),
  cursor: Type.Optional(Type.String()),
})

export const adminUserSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      id: UUID7String,
      username: Type.String(),
      email: Type.String(),
      postKarma: Type.Number(),
      commentKarma: Type.Number(),
      createdAt: Type.String({ format: "date-time" }),
      suspendedAt: Nullable(Type.String({ format: "date-time" })),
      suspensionReason: Nullable(Type.String()),
    }),
  ),
  nextCursor: Nullable(Type.String()),
})

export const adminSuspendSchemaRequest = Type.Object({
  reason: Nullable(Type.String()),
})
