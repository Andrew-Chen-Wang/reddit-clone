import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

export function fetchCommunityBookmark(db: Kysely<DB>) {
  async function getOne<T extends (keyof DB["communityBookmark"])[]>(
    id: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["communityBookmark"]>, T[number]> | undefined> {
    return await db
      .selectFrom("communityBookmark")
      .select(fields)
      .where("id", "=", id)
      .executeTakeFirst()
  }

  async function listForCommunity<T extends (keyof DB["communityBookmark"])[]>(
    communityId: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["communityBookmark"]>, T[number]>[]> {
    return await db
      .selectFrom("communityBookmark")
      .select(fields)
      .where("communityId", "=", communityId)
      .orderBy("position", "asc")
      .execute()
  }

  return { getOne, listForCommunity }
}
