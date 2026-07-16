import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

export function fetchRemovalReason(db: Kysely<DB>) {
  async function getOne<T extends (keyof DB["removalReason"])[]>(
    id: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["removalReason"]>, T[number]> | undefined> {
    return await db
      .selectFrom("removalReason")
      .select(fields)
      .where("id", "=", id)
      .executeTakeFirst()
  }

  async function getManyForCommunity<T extends (keyof DB["removalReason"])[]>(
    communityId: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["removalReason"]>, T[number]>[]> {
    return await db
      .selectFrom("removalReason")
      .select(fields)
      .where("communityId", "=", communityId)
      .orderBy("position", "asc")
      .execute()
  }

  async function countForCommunity(communityId: string): Promise<number> {
    const row = await db
      .selectFrom("removalReason")
      .where("communityId", "=", communityId)
      .select((eb) => eb.fn.count<string>("id").as("count"))
      .executeTakeFirstOrThrow()
    return Number(row.count)
  }

  return { getOne, getManyForCommunity, countForCommunity }
}
