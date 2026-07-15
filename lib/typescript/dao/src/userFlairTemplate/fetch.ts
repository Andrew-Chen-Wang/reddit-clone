import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

export function fetchUserFlairTemplate(db: Kysely<DB>) {
  async function getOne<T extends (keyof DB["userFlairTemplate"])[]>(
    id: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["userFlairTemplate"]>, T[number]> | undefined> {
    return await db
      .selectFrom("userFlairTemplate")
      .select(fields)
      .where("id", "=", id)
      .executeTakeFirst()
  }

  async function getManyForCommunity<T extends (keyof DB["userFlairTemplate"])[]>(
    communityId: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["userFlairTemplate"]>, T[number]>[]> {
    return await db
      .selectFrom("userFlairTemplate")
      .select(fields)
      .where("communityId", "=", communityId)
      .orderBy("position", "asc")
      .execute()
  }

  async function countForCommunity(communityId: string): Promise<number> {
    const row = await db
      .selectFrom("userFlairTemplate")
      .where("communityId", "=", communityId)
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .executeTakeFirstOrThrow()
    return Number(row.count)
  }

  return { getOne, getManyForCommunity, countForCommunity }
}
