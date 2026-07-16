import type { DB } from "@template-nextjs/db"
import type { Insertable, Kysely, Selectable, Updateable } from "kysely"
import { v7 } from "uuid"
import type { PartialBy } from "../utils/types"

export function crudChatConversation(db: Kysely<DB>) {
  async function create(
    data: PartialBy<Insertable<DB["chatConversation"]>, "id">,
  ): Promise<Selectable<DB["chatConversation"]>> {
    return await db
      .insertInto("chatConversation")
      .values({ id: v7(), ...data })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  async function update(
    id: string,
    data: Updateable<DB["chatConversation"]>,
  ): Promise<Selectable<DB["chatConversation"]> | undefined> {
    return await db
      .updateTable("chatConversation")
      .set(data)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst()
  }

  async function touch(id: string, at: Date): Promise<void> {
    await db
      .updateTable("chatConversation")
      .set({ lastMessageAt: at })
      .where("id", "=", id)
      .execute()
  }

  return { create, update, touch }
}
