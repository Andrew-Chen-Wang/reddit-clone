import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

export function fetchPostDraft(db: Kysely<DB>) {
  async function getOne<T extends (keyof DB["postDraft"])[]>(
    id: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["postDraft"]>, T[number]> | undefined> {
    return await db.selectFrom("postDraft").select(fields).where("id", "=", id).executeTakeFirst()
  }

  async function listForUser(userId: string): Promise<Selectable<DB["postDraft"]>[]> {
    return await db
      .selectFrom("postDraft")
      .selectAll()
      .where("userId", "=", userId)
      .orderBy("updatedAt", "desc")
      .execute()
  }

  async function countForUser(userId: string): Promise<number> {
    const row = await db
      .selectFrom("postDraft")
      .where("userId", "=", userId)
      .select((eb) => eb.fn.count<string>("id").as("count"))
      .executeTakeFirstOrThrow()
    return Number(row.count)
  }

  return { getOne, listForUser, countForUser }
}
