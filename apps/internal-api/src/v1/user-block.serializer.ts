import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

export const usernameSchemaParam = Type.Object({
  username: Type.String(),
})

export const blockStateSchemaResponse = Type.Object({
  blocked: Type.Boolean(),
})

export const blockListSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      id: UUID7String,
      username: Type.String(),
      displayName: Nullable(Type.String()),
      avatarImageKey: Nullable(Type.String()),
      createdAt: Type.String({ format: "date-time" }),
    }),
  ),
})
