import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

export function fetchUserSocialLink(db: Kysely<DB>) {
  async function listByUserId<T extends (keyof DB["userSocialLink"])[]>(
    userId: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["userSocialLink"]>, T[number]>[]> {
    return await db
      .selectFrom("userSocialLink")
      .select(fields)
      .where("userId", "=", userId)
      .orderBy("position", "asc")
      .execute()
  }

  async function countByUserId(userId: string): Promise<number> {
    const row = await db
      .selectFrom("userSocialLink")
      .where("userId", "=", userId)
      .select((eb) => eb.fn.count<string>("id").as("count"))
      .executeTakeFirstOrThrow()
    return Number(row.count)
  }

  return { listByUserId, countByUserId }
}
