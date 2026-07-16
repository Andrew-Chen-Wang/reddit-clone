import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

const MESSAGE_FIELDS = [
  "id",
  "conversationId",
  "senderUserId",
  "body",
  "deletedAt",
  "createdAt",
] as const

export function fetchChatMessage(db: Kysely<DB>) {
  async function getOne<T extends (keyof DB["chatMessage"])[]>(
    id: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["chatMessage"]>, T[number]> | undefined> {
    return await db.selectFrom("chatMessage").select(fields).where("id", "=", id).executeTakeFirst()
  }

  async function listAfter(conversationId: string, afterCreatedAt: Date, afterId: string) {
    return await db
      .selectFrom("chatMessage")
      .select(MESSAGE_FIELDS)
      .where("conversationId", "=", conversationId)
      .where((eb) =>
        eb.or([
          eb("createdAt", ">", afterCreatedAt),
          eb.and([eb("createdAt", "=", afterCreatedAt), eb("id", ">", afterId)]),
        ]),
      )
      .orderBy("createdAt", "asc")
      .orderBy("id", "asc")
      .limit(200)
      .execute()
  }

  async function listPage(conversationId: string, beforeCreatedAt: Date | null, limit: number) {
    const base = db
      .selectFrom("chatMessage")
      .select(MESSAGE_FIELDS)
      .where("conversationId", "=", conversationId)
    const filtered = beforeCreatedAt ? base.where("createdAt", "<", beforeCreatedAt) : base
    return await filtered
      .orderBy("createdAt", "desc")
      .orderBy("id", "desc")
      .limit(limit + 1)
      .execute()
  }

  return { getOne, listAfter, listPage }
}
