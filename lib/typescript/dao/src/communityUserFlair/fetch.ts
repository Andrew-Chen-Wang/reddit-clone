import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

export function fetchCommunityUserFlair(db: Kysely<DB>) {
  async function getOne<T extends (keyof DB["communityUserFlair"])[]>(
    communityId: string,
    userId: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["communityUserFlair"]>, T[number]> | undefined> {
    return await db
      .selectFrom("communityUserFlair")
      .select(fields)
      .where("communityId", "=", communityId)
      .where("userId", "=", userId)
      .executeTakeFirst()
  }

  return { getOne }
}
