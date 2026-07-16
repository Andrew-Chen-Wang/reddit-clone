import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

export const usernameSchemaParam = Type.Object({
  username: Type.String(),
})

export const followStateSchemaResponse = Type.Object({
  following: Type.Boolean(),
})

export const followListSchemaResponse = Type.Object({
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
