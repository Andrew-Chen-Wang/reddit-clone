import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

export const postInsightsSchemaParam = Type.Object({
  postId: UUID7String,
})

export const postInsightsSchemaResponse = Type.Object({
  postTitle: Type.String(),
  communityName: Nullable(Type.String()),
  viewsTotal: Type.Number(),
  views48h: Type.Array(
    Type.Object({
      bucket: Type.String({ format: "date-time" }),
      count: Type.Number(),
    }),
  ),
  ups: Type.Number(),
  downs: Type.Number(),
  upvoteRatio: Type.Number(),
  commentCount: Type.Number(),
  shareCount: Type.Number(),
  crosspostCount: Type.Number(),
  topComments: Type.Array(
    Type.Object({
      id: UUID7String,
      snippet: Type.String(),
      score: Type.Number(),
      authorUsername: Nullable(Type.String()),
    }),
  ),
  rankAllTime: Type.Number(),
  rankInCommunityToday: Nullable(Type.Number()),
})
