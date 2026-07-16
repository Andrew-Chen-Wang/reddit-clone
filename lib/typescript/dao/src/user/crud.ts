import type { DB } from "@template-nextjs/db"
import type { Insertable, Kysely, Selectable, Updateable } from "kysely"
import { v7 } from "uuid"
import { PartialBy } from "../utils/types"

export function crudUser(db: Kysely<DB>) {
  async function createUser(
    data: PartialBy<Insertable<DB["user"]>, "id">,
  ): Promise<Selectable<DB["user"]>> {
    const values = { id: data.id ?? v7(), ...data }
    return await db.transaction().execute(async (tx) => {
      return await tx.insertInto("user").values(values).returningAll().executeTakeFirstOrThrow()
    })
  }

  async function updateUser(
    id: string,
    data: Updateable<DB["user"]>,
  ): Promise<Selectable<DB["user"]> | undefined> {
    return await db
      .updateTable("user")
      .set(data)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst()
  }

  async function deleteUser(userId: string): Promise<boolean> {
    try {
      await db.transaction().execute(async (tx) => {
        await tx.deleteFrom("user").where("id", "=", userId).execute()
      })
      return true
    } catch {
      return false
    }
  }

  async function suspend(id: string, reason: string | null): Promise<boolean> {
    const result = await db
      .updateTable("user")
      .set({ suspendedAt: new Date(), suspensionReason: reason })
      .where("id", "=", id)
      .executeTakeFirst()
    return (result.numUpdatedRows ?? 0n) > 0n
  }

  async function unsuspend(id: string): Promise<boolean> {
    const result = await db
      .updateTable("user")
      .set({ suspendedAt: null, suspensionReason: null })
      .where("id", "=", id)
      .executeTakeFirst()
    return (result.numUpdatedRows ?? 0n) > 0n
  }

  return { createUser, updateUser, deleteUser, suspend, unsuspend }
}
