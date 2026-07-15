import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

export function fetchAccount(db: Kysely<DB>) {
  async function getOneByProvider<T extends (keyof DB["account"])[]>(
    provider: string,
    providerAccountId: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["account"]>, T[number]> | undefined> {
    return await db
      .selectFrom("account")
      .select(fields)
      .where("provider", "=", provider)
      .where("providerAccountId", "=", providerAccountId)
      .executeTakeFirst()
  }

  return { getOneByProvider }
}
