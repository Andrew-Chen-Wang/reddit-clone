import type { DB } from "@template-nextjs/db"
import type { Insertable, Kysely, Selectable } from "kysely"
import { v7 } from "uuid"
import type { PartialBy } from "../utils/types"

export function crudChatMessage(db: Kysely<DB>) {
  async function create(
    data: PartialBy<Insertable<DB["chatMessage"]>, "id">,
  ): Promise<Selectable<DB["chatMessage"]>> {
    return await db
      .insertInto("chatMessage")
      .values({ id: v7(), ...data })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  async function softDelete(id: string, at: Date): Promise<void> {
    await db.updateTable("chatMessage").set({ deletedAt: at }).where("id", "=", id).execute()
  }

  return { create, softDelete }
}
