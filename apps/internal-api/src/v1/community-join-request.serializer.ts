import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

export const joinRequestCommunityIdSchemaParam = Type.Object({
  communityId: UUID7String,
})

export const joinRequestIdSchemaParam = Type.Object({
  id: UUID7String,
})

export const joinRequestListSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      id: UUID7String,
      userId: UUID7String,
      username: Type.String(),
      avatarImageKey: Nullable(Type.String()),
      message: Nullable(Type.String()),
      createdAt: Type.String({ format: "date-time" }),
    }),
  ),
})
