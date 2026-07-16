import type { DB } from "@template-nextjs/db"
import type { Insertable, Kysely, Selectable, Updateable } from "kysely"
import { v7 } from "uuid"
import type { PartialBy } from "../utils/types"

export function crudModmailConversation(db: Kysely<DB>) {
  async function create(
    data: PartialBy<Insertable<DB["modmailConversation"]>, "id">,
  ): Promise<Selectable<DB["modmailConversation"]>> {
    return await db
      .insertInto("modmailConversation")
      .values({ id: v7(), ...data })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  async function update(
    id: string,
    data: Updateable<DB["modmailConversation"]>,
  ): Promise<Selectable<DB["modmailConversation"]> | undefined> {
    return await db
      .updateTable("modmailConversation")
      .set(data)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst()
  }

  return { create, update }
}
