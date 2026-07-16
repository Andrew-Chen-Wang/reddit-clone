import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export interface HourlyViewBucket {
  bucket: string
  count: number
}

const HOUR_MS = 60 * 60 * 1000

export function fetchPostViewHourly(db: Kysely<DB>) {
  async function histogram(postId: string, hours = 48): Promise<HourlyViewBucket[]> {
    const since = new Date(Date.now() - hours * HOUR_MS)
    const rows = await db
      .selectFrom("postViewHourly")
      .where("postId", "=", postId)
      .where("bucket", ">=", since)
      .select(["bucket", "viewCount"])
      .orderBy("bucket", "asc")
      .execute()

    return rows.map((r) => ({ bucket: r.bucket.toISOString(), count: r.viewCount }))
  }

  async function totals(postId: string): Promise<number> {
    const row = await db
      .selectFrom("postViewHourly")
      .where("postId", "=", postId)
      .select((eb) => eb.fn.sum<string>("viewCount").as("total"))
      .executeTakeFirst()
    return row?.total ? Number(row.total) : 0
  }

  return { histogram, totals }
}
