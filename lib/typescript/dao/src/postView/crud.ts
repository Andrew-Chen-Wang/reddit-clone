import type { DB } from "@template-nextjs/db"
import { type Kysely, sql } from "kysely"
import { crudPostViewHourly } from "../postViewHourly/crud"

export function crudPostView(db: Kysely<DB>) {
  async function recordView(postId: string, userId: string): Promise<void> {
    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto("postView")
        .values({ postId, userId, viewedAt: new Date() })
        .onConflict((oc) => oc.columns(["userId", "postId"]).doUpdateSet({ viewedAt: new Date() }))
        .execute()

      await trx
        .updateTable("post")
        .set({ viewCount: sql`${sql.ref("viewCount")} + 1` })
        .where("id", "=", postId)
        .execute()

      await crudPostViewHourly(trx).upsertBucket(postId)
    })
  }

  async function clearForUser(userId: string): Promise<void> {
    await db.deleteFrom("postView").where("userId", "=", userId).execute()
  }

  return { recordView, clearForUser }
}
