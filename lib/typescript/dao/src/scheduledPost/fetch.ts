import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

export function fetchScheduledPost(db: Kysely<DB>) {
  async function getOne<T extends (keyof DB["scheduledPost"])[]>(
    id: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["scheduledPost"]>, T[number]> | undefined> {
    return await db
      .selectFrom("scheduledPost")
      .select(fields)
      .where("id", "=", id)
      .executeTakeFirst()
  }

  async function listForUser(authorUserId: string): Promise<Selectable<DB["scheduledPost"]>[]> {
    return await db
      .selectFrom("scheduledPost")
      .selectAll()
      .where("authorUserId", "=", authorUserId)
      .orderBy("scheduledAt", "asc")
      .execute()
  }

  async function listForCommunity(communityId: string): Promise<Selectable<DB["scheduledPost"]>[]> {
    return await db
      .selectFrom("scheduledPost")
      .selectAll()
      .where("communityId", "=", communityId)
      .orderBy("scheduledAt", "asc")
      .execute()
  }

  async function duePage(now: Date, limit: number): Promise<Selectable<DB["scheduledPost"]>[]> {
    return await db
      .selectFrom("scheduledPost")
      .selectAll()
      .where("status", "=", "scheduled")
      .where("scheduledAt", "<=", now)
      .orderBy("scheduledAt", "asc")
      .limit(limit)
      .execute()
  }

  async function listPublishedRecurring(): Promise<Selectable<DB["scheduledPost"]>[]> {
    return await db
      .selectFrom("scheduledPost")
      .selectAll()
      .where("status", "=", "published")
      .where("recurrence", "is not", null)
      .execute()
  }

  async function existsByJobId(jobId: string): Promise<boolean> {
    const row = await db
      .selectFrom("scheduledPost")
      .select("id")
      .where("jobId", "=", jobId)
      .executeTakeFirst()
    return row !== undefined
  }

  return {
    getOne,
    listForUser,
    listForCommunity,
    duePage,
    listPublishedRecurring,
    existsByJobId,
  }
}
