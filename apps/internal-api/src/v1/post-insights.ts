import { fetchCommunity } from "@lib/dao/community/fetch"
import { fetchPost } from "@lib/dao/post/fetch"
import { fetchPostInsights, type InsightTopComment } from "@lib/dao/postInsights/fetch"
import { fetchPostViewHourly, type HourlyViewBucket } from "@lib/dao/postViewHourly/fetch"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware } from "../middleware"
import { ErrorSchemaResponse } from "../utils/common.serializer"
import { throwForbidden, throwNotFound } from "../utils/http-exception"
import { postInsightsSchemaParam, postInsightsSchemaResponse } from "./post-insights.serializer"

function startOfTodayUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

interface InsightsPayload {
  postTitle: string
  communityName: string | null
  viewsTotal: number
  views48h: HourlyViewBucket[]
  ups: number
  downs: number
  upvoteRatio: number
  commentCount: number
  shareCount: number
  crosspostCount: number
  topComments: InsightTopComment[]
  rankAllTime: number
  rankInCommunityToday: number | null
}

const app = new Hono().use(authMiddleware).get(
  "/:postId",
  describeRoute({
    description: "Insights for a post (author only)",
    responses: {
      200: {
        description: "Post insights",
        content: { "application/json": { schema: resolver(postInsightsSchemaResponse) } },
      },
      403: {
        description: "Not the author",
        content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
      },
      404: {
        description: "Post not found",
        content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
      },
    },
  }),
  validator("param", postInsightsSchemaParam),
  async (c) => {
    const user = c.var.user
    const { postId } = c.req.valid("param")

    const post = await fetchPost(db).getOne(postId, [
      "authorUserId",
      "communityId",
      "title",
      "ups",
      "downs",
      "score",
      "commentCount",
      "shareCount",
      "viewCount",
    ])
    if (!post) return throwNotFound(c, "Post not found")
    if (post.authorUserId !== user.id) return throwForbidden(c, "You cannot view these insights")

    const communityName = post.communityId
      ? ((await fetchCommunity(db).getOne(post.communityId, ["name"]))?.name ?? null)
      : null

    const views48h = await fetchPostViewHourly(db).histogram(postId, 48)
    const crosspostCount = await fetchPostInsights(db).countCrossposts(postId)
    const topComments = await fetchPostInsights(db).topComments(postId, 3)
    const rankAllTime = await fetchPostInsights(db).rankAllTime(post.authorUserId, post.score)
    const rankInCommunityToday = post.communityId
      ? await fetchPostInsights(db).rankInCommunityToday(
          post.communityId,
          post.score,
          startOfTodayUtc(),
        )
      : null

    const total = post.ups + post.downs
    const upvoteRatio = total > 0 ? post.ups / total : 1

    const payload: InsightsPayload = {
      postTitle: post.title,
      communityName,
      viewsTotal: Number(post.viewCount),
      views48h,
      ups: post.ups,
      downs: post.downs,
      upvoteRatio,
      commentCount: post.commentCount,
      shareCount: post.shareCount,
      crosspostCount,
      topComments,
      rankAllTime,
      rankInCommunityToday,
    }
    return c.json(payload)
  },
)

export default app
