import type { DB } from "@template-nextjs/db"
import type { Insertable, Kysely, Selectable } from "kysely"
import { v7 } from "uuid"
import type { PartialBy } from "../utils/types"

export function crudChatParticipant(db: Kysely<DB>) {
  async function create(
    data: PartialBy<Insertable<DB["chatParticipant"]>, "id">,
  ): Promise<Selectable<DB["chatParticipant"]>> {
    return await db
      .insertInto("chatParticipant")
      .values({ id: v7(), ...data })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  async function createMany(
    rows: PartialBy<Insertable<DB["chatParticipant"]>, "id">[],
  ): Promise<void> {
    if (rows.length === 0) return
    await db
      .insertInto("chatParticipant")
      .values(rows.map((r) => ({ id: v7(), ...r })))
      .execute()
  }

  async function setStatus(conversationId: string, userId: string, status: string): Promise<void> {
    await db
      .updateTable("chatParticipant")
      .set({ status })
      .where("conversationId", "=", conversationId)
      .where("userId", "=", userId)
      .execute()
  }

  async function markRead(conversationId: string, userId: string, at: Date): Promise<void> {
    await db
      .updateTable("chatParticipant")
      .set({ lastReadAt: at })
      .where("conversationId", "=", conversationId)
      .where("userId", "=", userId)
      .execute()
  }

  async function setHidden(
    conversationId: string,
    userId: string,
    hiddenAt: Date | null,
  ): Promise<void> {
    await db
      .updateTable("chatParticipant")
      .set({ hiddenAt })
      .where("conversationId", "=", conversationId)
      .where("userId", "=", userId)
      .execute()
  }

  async function remove(conversationId: string, userId: string): Promise<boolean> {
    const result = await db
      .deleteFrom("chatParticipant")
      .where("conversationId", "=", conversationId)
      .where("userId", "=", userId)
      .executeTakeFirst()
    return (result.numDeletedRows ?? 0n) > 0n
  }

  return { create, createMany, setStatus, markRead, setHidden, remove }
}
