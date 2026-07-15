import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

export function fetchCommunity(db: Kysely<DB>) {
  async function getOne<T extends (keyof DB["community"])[]>(
    id: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["community"]>, T[number]> | undefined> {
    return await db.selectFrom("community").select(fields).where("id", "=", id).executeTakeFirst()
  }

  async function getOneByName<T extends (keyof DB["community"])[]>(
    name: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["community"]>, T[number]> | undefined> {
    return await db
      .selectFrom("community")
      .select(fields)
      .where((eb) => eb(eb.fn("lower", ["name"]), "=", name.toLowerCase()))
      .executeTakeFirst()
  }

  async function isNameTaken(name: string): Promise<boolean> {
    const row = await db
      .selectFrom("community")
      .select("id")
      .where((eb) => eb(eb.fn("lower", ["name"]), "=", name.toLowerCase()))
      .executeTakeFirst()
    return row !== undefined
  }

  async function getManyByIds<T extends (keyof DB["community"])[]>(
    ids: string[],
    fields: T,
  ): Promise<Pick<Selectable<DB["community"]>, T[number]>[]> {
    if (ids.length === 0) return []
    return await db.selectFrom("community").select(fields).where("id", "in", ids).execute()
  }

  async function getManyByTopic<T extends (keyof DB["community"])[]>(
    topicId: string,
    fields: T,
    limit: number,
    offset: number,
  ): Promise<Pick<Selectable<DB["community"]>, T[number]>[]> {
    return await db
      .selectFrom("community")
      .select(fields)
      .where("topicId", "=", topicId)
      .where("visibility", "in", ["public", "restricted"])
      .orderBy("memberCount", "desc")
      .orderBy((eb) => eb.fn("lower", ["name"]), "asc")
      .limit(limit)
      .offset(offset)
      .execute()
  }

  return { getOne, getOneByName, isNameTaken, getManyByIds, getManyByTopic }
}
