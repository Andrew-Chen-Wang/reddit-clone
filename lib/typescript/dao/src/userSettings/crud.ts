import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable, Updateable } from "kysely"

export function crudUserSettings(db: Kysely<DB>) {
  async function upsert(
    userId: string,
    data: Updateable<DB["userSettings"]>,
  ): Promise<Selectable<DB["userSettings"]>> {
    return await db
      .insertInto("userSettings")
      .values({ ...data, userId })
      .onConflict((oc) => oc.column("userId").doUpdateSet(data))
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  return { upsert }
}
