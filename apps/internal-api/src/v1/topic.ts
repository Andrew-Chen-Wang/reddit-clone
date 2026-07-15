import { fetchTopic } from "@lib/dao/topic/fetch"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver } from "hono-typebox-openapi/typebox"
import { authNoThrowMiddleware } from "../middleware"
import { topicListSchemaResponse } from "./topic.serializer"

const app = new Hono().get(
  "/",
  authNoThrowMiddleware,
  describeRoute({
    description: "List all topics ordered by display order",
    responses: {
      200: {
        description: "List of topics",
        content: {
          "application/json": {
            schema: resolver(topicListSchemaResponse),
          },
        },
      },
    },
  }),
  async (c) => {
    const topics = await fetchTopic(db).getMany(["id", "name", "slug", "displayOrder"])
    return c.json({ data: topics })
  },
)

export default app
