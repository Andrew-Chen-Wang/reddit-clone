import { db } from "@template-nextjs/db"
import { ensureSearchIndexes } from "@template-nextjs/search"
import type { JobPayloadMap } from "@utils/queues"
import { syncComment, syncCommunity, syncPost, syncUser } from "./esSync"

const BATCH_SIZE = 500

type Table = "post" | "comment" | "community" | "user"

async function walkIds(table: Table, handle: (id: string) => Promise<void>): Promise<number> {
  let lastId = ""
  let processed = 0
  for (;;) {
    const rows = await db
      .selectFrom(table)
      .select("id")
      .$if(lastId !== "", (qb) => qb.where("id", ">", lastId))
      .orderBy("id", "asc")
      .limit(BATCH_SIZE)
      .execute()
    if (rows.length === 0) break
    for (const row of rows) {
      await handle(row.id)
      processed++
    }
    lastId = rows[rows.length - 1].id
    if (rows.length < BATCH_SIZE) break
  }
  return processed
}

export async function processEsBackfill(_data: JobPayloadMap["es-backfill"]): Promise<void> {
  await ensureSearchIndexes()

  const communities = await walkIds("community", syncCommunity)
  const users = await walkIds("user", syncUser)
  const posts = await walkIds("post", syncPost)
  const comments = await walkIds("comment", syncComment)

  console.info(
    `[es-backfill] indexed communities=${communities} users=${users} posts=${posts} comments=${comments}`,
  )
}
