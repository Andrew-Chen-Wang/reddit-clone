import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

export function fetchChatParticipant(db: Kysely<DB>) {
  async function getOne<T extends (keyof DB["chatParticipant"])[]>(
    conversationId: string,
    userId: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["chatParticipant"]>, T[number]> | undefined> {
    return await db
      .selectFrom("chatParticipant")
      .select(fields)
      .where("conversationId", "=", conversationId)
      .where("userId", "=", userId)
      .executeTakeFirst()
  }

  async function listForConversation(conversationId: string) {
    return await db
      .selectFrom("chatParticipant as p")
      .innerJoin("user as u", "u.id", "p.userId")
      .where("p.conversationId", "=", conversationId)
      .select([
        "p.userId as userId",
        "p.role as role",
        "p.status as status",
        "u.username as username",
        "u.displayName as displayName",
        "u.avatarImageKey as avatarImageKey",
      ])
      .orderBy("p.createdAt", "asc")
      .execute()
  }

  async function countForConversation(conversationId: string): Promise<number> {
    const row = await db
      .selectFrom("chatParticipant")
      .where("conversationId", "=", conversationId)
      .select((eb) => eb.fn.count<string>("id").as("count"))
      .executeTakeFirstOrThrow()
    return Number(row.count)
  }

  return { getOne, listForConversation, countForConversation }
}
