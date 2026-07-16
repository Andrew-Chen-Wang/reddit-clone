import type { DB } from "@template-nextjs/db"
import type { Insertable, Kysely, Selectable } from "kysely"
import { v7 } from "uuid"
import type { PartialBy } from "../utils/types"

export function crudModmailMessage(db: Kysely<DB>) {
  async function create(
    data: PartialBy<Insertable<DB["modmailMessage"]>, "id">,
  ): Promise<Selectable<DB["modmailMessage"]>> {
    return await db
      .insertInto("modmailMessage")
      .values({ id: v7(), ...data })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  return { create }
}
