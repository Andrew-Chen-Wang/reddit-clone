import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

const notificationLevel = Type.Union([
  Type.Literal("off"),
  Type.Literal("low"),
  Type.Literal("frequent"),
])

export const communityIdSchemaParam = Type.Object({
  communityId: UUID7String,
})

export const communityJoinSchemaResponse = Type.Object({
  joined: Type.Boolean(),
  requested: Type.Boolean(),
})

export const membershipUpdateSchemaRequest = Type.Object({
  isFavorite: Type.Optional(Type.Boolean()),
  notificationLevel: Type.Optional(notificationLevel),
})

export const myCommunitiesSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      id: UUID7String,
      name: Type.String(),
      displayName: Nullable(Type.String()),
      iconImageKey: Nullable(Type.String()),
      isFavorite: Type.Boolean(),
      notificationLevel: Type.String(),
    }),
  ),
})

export const moderatedCommunitiesSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      id: UUID7String,
      name: Type.String(),
      displayName: Nullable(Type.String()),
      iconImageKey: Nullable(Type.String()),
    }),
  ),
})
