import type { DB } from "@template-nextjs/db"
import { type Kysely, sql } from "kysely"

const HOUR_MS = 60 * 60 * 1000

export function hourBucket(at: Date): Date {
  return new Date(Math.floor(at.getTime() / HOUR_MS) * HOUR_MS)
}

export function crudPostViewHourly(db: Kysely<DB>) {
  async function upsertBucket(postId: string, at: Date = new Date()): Promise<void> {
    await db
      .insertInto("postViewHourly")
      .values({ postId, bucket: hourBucket(at), viewCount: 1 })
      .onConflict((oc) =>
        oc
          .columns(["postId", "bucket"])
          .doUpdateSet({ viewCount: sql`post_view_hourly.view_count + 1` }),
      )
      .execute()
  }

  return { upsertBucket }
}
