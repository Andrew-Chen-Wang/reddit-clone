import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

export const exploreSchemaQuery = Type.Object({
  topic: Type.Optional(Type.String()),
  offset: Type.Optional(Type.Number({ minimum: 0, multipleOf: 1 })),
})

const communityCard = Type.Object({
  id: UUID7String,
  name: Type.String(),
  displayName: Nullable(Type.String()),
  description: Type.String(),
  iconImageKey: Nullable(Type.String()),
  memberCount: Type.Number(),
  isNsfw: Type.Boolean(),
})

export const exploreSchemaResponse = Type.Object({
  topics: Type.Array(
    Type.Object({
      id: UUID7String,
      name: Type.String(),
      slug: Type.String(),
    }),
  ),
  sections: Type.Array(
    Type.Object({
      topicId: UUID7String,
      topicName: Type.String(),
      topicSlug: Type.String(),
      communities: Type.Array(communityCard),
      hasMore: Type.Boolean(),
    }),
  ),
  recommended: Type.Array(communityCard),
  moreLike: Type.Array(
    Type.Object({
      basedOn: Type.String(),
      communities: Type.Array(communityCard),
    }),
  ),
})
