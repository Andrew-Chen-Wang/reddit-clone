import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

export function fetchModSavedResponse(db: Kysely<DB>) {
  async function getOne<T extends (keyof DB["modSavedResponse"])[]>(
    id: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["modSavedResponse"]>, T[number]> | undefined> {
    return await db
      .selectFrom("modSavedResponse")
      .select(fields)
      .where("id", "=", id)
      .executeTakeFirst()
  }

  async function getManyForCommunity<T extends (keyof DB["modSavedResponse"])[]>(
    communityId: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["modSavedResponse"]>, T[number]>[]> {
    return await db
      .selectFrom("modSavedResponse")
      .select(fields)
      .where("communityId", "=", communityId)
      .orderBy("createdAt", "asc")
      .execute()
  }

  async function countForCommunity(communityId: string): Promise<number> {
    const row = await db
      .selectFrom("modSavedResponse")
      .where("communityId", "=", communityId)
      .select((eb) => eb.fn.count<string>("id").as("count"))
      .executeTakeFirstOrThrow()
    return Number(row.count)
  }

  return { getOne, getManyForCommunity, countForCommunity }
}
