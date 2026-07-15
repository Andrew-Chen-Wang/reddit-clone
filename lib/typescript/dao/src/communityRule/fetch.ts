import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

export function fetchCommunityRule(db: Kysely<DB>) {
  async function getOne<T extends (keyof DB["communityRule"])[]>(
    id: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["communityRule"]>, T[number]> | undefined> {
    return await db
      .selectFrom("communityRule")
      .select(fields)
      .where("id", "=", id)
      .executeTakeFirst()
  }

  async function getManyForCommunity<T extends (keyof DB["communityRule"])[]>(
    communityId: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["communityRule"]>, T[number]>[]> {
    return await db
      .selectFrom("communityRule")
      .select(fields)
      .where("communityId", "=", communityId)
      .orderBy("position", "asc")
      .execute()
  }

  return { getOne, getManyForCommunity }
}
