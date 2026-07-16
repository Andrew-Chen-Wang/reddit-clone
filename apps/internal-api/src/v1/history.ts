import { fetchCommunityVisit } from "@lib/dao/communityVisit/fetch"
import { fetchPost } from "@lib/dao/post/fetch"
import { processPosts } from "@lib/dao/post/processPost"
import { crudPostView } from "@lib/dao/postView/crud"
import { fetchPostView } from "@lib/dao/postView/fetch"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware } from "../middleware"
import { EmptyObject } from "../utils/common.serializer"
import { cursorOffsetPaginate } from "../utils/pagination"
import { feedSchemaResponse } from "./feed.serializer"
import { recentCommunitiesSchemaResponse, recentPostsSchemaResponse } from "./history.serializer"
import { postTabSchemaQuery } from "./user-tabs.serializer"

const RECENT_POSTS_LIMIT = 10
const RECENT_COMMUNITIES_LIMIT = 5
const HISTORY_PAGE_SIZE = 25

const app = new Hono()
  .use(authMiddleware)
  .get(
    "/recent-posts",
    describeRoute({
      description: "Recently viewed posts for the current user",
      responses: {
        200: {
          description: "Recently viewed posts",
          content: { "application/json": { schema: resolver(recentPostsSchemaResponse) } },
        },
      },
    }),
    async (c) => {
      const user = c.var.user
      const data = await fetchPostView(db).getRecentForUser(user.id, RECENT_POSTS_LIMIT)
      return c.json({ data })
    },
  )
  .get(
    "/posts",
    describeRoute({
      description: "Paginated feed of the current user's recently viewed posts, newest view first",
      responses: {
        200: {
          description: "Recently viewed posts",
          content: { "application/json": { schema: resolver(feedSchemaResponse) } },
        },
      },
    }),
    validator("query", postTabSchemaQuery),
    async (c) => {
      const user = c.var.user
      const cursor = c.req.valid("query").cursor ?? null
      const { results, nextCursor } = await cursorOffsetPaginate({
        query: fetchPost(db).viewedPostsFeed(user.id),
        cursor,
        ordering: "id",
        positionColumn: "post.id",
        pageSize: HISTORY_PAGE_SIZE,
      })
      const data = await processPosts(db, results, user.id)
      return c.json({ data, nextCursor })
    },
  )
  .delete(
    "/recent-posts",
    describeRoute({
      description: "Clear the current user's recently viewed posts",
      responses: {
        200: {
          description: "History cleared",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
      },
    }),
    async (c) => {
      const user = c.var.user
      await crudPostView(db).clearForUser(user.id)
      return c.json({})
    },
  )
  .get(
    "/recent-communities",
    describeRoute({
      description: "Recently visited communities for the current user",
      responses: {
        200: {
          description: "Recently visited communities",
          content: { "application/json": { schema: resolver(recentCommunitiesSchemaResponse) } },
        },
      },
    }),
    async (c) => {
      const user = c.var.user
      const data = await fetchCommunityVisit(db).getRecentForUser(user.id, RECENT_COMMUNITIES_LIMIT)
      return c.json({ data })
    },
  )

export default app
