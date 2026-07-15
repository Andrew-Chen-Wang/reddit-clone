import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

export function fetchUserSettings(db: Kysely<DB>) {
  async function getOne<T extends (keyof DB["userSettings"])[]>(
    userId: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["userSettings"]>, T[number]> | undefined> {
    return await db
      .selectFrom("userSettings")
      .select(fields)
      .where("userId", "=", userId)
      .executeTakeFirst()
  }

  return { getOne }
}
