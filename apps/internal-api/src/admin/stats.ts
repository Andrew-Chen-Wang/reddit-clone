import { fetchAdmin } from "@lib/dao"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver } from "hono-typebox-openapi/typebox"
import { adminAuthMiddleware } from "./middleware"
import { adminStatsSchemaResponse } from "./stats.serializer"

const app = new Hono().use(adminAuthMiddleware).get(
  "/",
  describeRoute({
    description: "Site-wide counts overview",
    responses: {
      200: {
        description: "Counts",
        content: { "application/json": { schema: resolver(adminStatsSchemaResponse) } },
      },
    },
  }),
  async (c) => {
    const counts = await fetchAdmin(db).counts()
    return c.json(counts)
  },
)

export default app
