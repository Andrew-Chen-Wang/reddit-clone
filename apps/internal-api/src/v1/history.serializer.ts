import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

export const recentPostsSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      postId: UUID7String,
      title: Type.String(),
      type: Type.String(),
      communityId: Nullable(UUID7String),
      communityName: Nullable(Type.String()),
      communityIconImageKey: Nullable(Type.String()),
      score: Type.Number(),
      commentCount: Type.Number(),
      viewedAt: Type.String({ format: "date-time" }),
    }),
  ),
})

export const recentCommunitiesSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      communityId: UUID7String,
      name: Type.String(),
      iconImageKey: Nullable(Type.String()),
      lastVisitedAt: Type.String({ format: "date-time" }),
    }),
  ),
})
