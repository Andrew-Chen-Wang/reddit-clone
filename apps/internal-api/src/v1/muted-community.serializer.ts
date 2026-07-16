import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

export const mutedCommunitySchemaParam = Type.Object({
  communityId: UUID7String,
})

export const muteStateSchemaResponse = Type.Object({
  muted: Type.Boolean(),
})

export const mutedListSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      id: UUID7String,
      name: Type.String(),
      displayName: Nullable(Type.String()),
      iconImageKey: Nullable(Type.String()),
      createdAt: Type.String({ format: "date-time" }),
    }),
  ),
})
