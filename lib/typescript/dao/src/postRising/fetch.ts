import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

export function fetchPostRising(db: Kysely<DB>) {
  async function getManyByCommunity<T extends (keyof DB["postRising"])[]>(
    communityId: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["postRising"]>, T[number]>[]> {
    return await db
      .selectFrom("postRising")
      .select(fields)
      .where("communityId", "=", communityId)
      .orderBy("score", "desc")
      .execute()
  }

  async function getAll<T extends (keyof DB["postRising"])[]>(
    fields: T,
  ): Promise<Pick<Selectable<DB["postRising"]>, T[number]>[]> {
    return await db.selectFrom("postRising").select(fields).orderBy("score", "desc").execute()
  }

  return { getManyByCommunity, getAll }
}
