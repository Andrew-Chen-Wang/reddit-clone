import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

export function fetchPostFlairTemplate(db: Kysely<DB>) {
  async function getOne<T extends (keyof DB["postFlairTemplate"])[]>(
    id: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["postFlairTemplate"]>, T[number]> | undefined> {
    return await db
      .selectFrom("postFlairTemplate")
      .select(fields)
      .where("id", "=", id)
      .executeTakeFirst()
  }

  async function getManyForCommunity<T extends (keyof DB["postFlairTemplate"])[]>(
    communityId: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["postFlairTemplate"]>, T[number]>[]> {
    return await db
      .selectFrom("postFlairTemplate")
      .select(fields)
      .where("communityId", "=", communityId)
      .orderBy("position", "asc")
      .execute()
  }

  async function countForCommunity(communityId: string): Promise<number> {
    const row = await db
      .selectFrom("postFlairTemplate")
      .where("communityId", "=", communityId)
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .executeTakeFirstOrThrow()
    return Number(row.count)
  }

  return { getOne, getManyForCommunity, countForCommunity }
}
