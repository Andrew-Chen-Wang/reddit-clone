import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

export function fetchCommunityWidget(db: Kysely<DB>) {
  async function getOne<T extends (keyof DB["communityWidget"])[]>(
    id: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["communityWidget"]>, T[number]> | undefined> {
    return await db
      .selectFrom("communityWidget")
      .select(fields)
      .where("id", "=", id)
      .executeTakeFirst()
  }

  async function listForCommunity<T extends (keyof DB["communityWidget"])[]>(
    communityId: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["communityWidget"]>, T[number]>[]> {
    return await db
      .selectFrom("communityWidget")
      .select(fields)
      .where("communityId", "=", communityId)
      .orderBy("position", "asc")
      .execute()
  }

  return { getOne, listForCommunity }
}
