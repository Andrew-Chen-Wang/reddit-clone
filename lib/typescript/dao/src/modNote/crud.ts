import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable, Updateable } from "kysely"
import { v7 } from "uuid"

interface CreateModNoteInput {
  communityId: string
  targetUserId: string
  label?: string | null
  note: string
  createdByUserId: string | null
}

export function crudModNote(db: Kysely<DB>) {
  async function create(input: CreateModNoteInput): Promise<Selectable<DB["modNote"]>> {
    return await db
      .insertInto("modNote")
      .values({
        id: v7(),
        communityId: input.communityId,
        targetUserId: input.targetUserId,
        label: input.label ?? null,
        note: input.note,
        createdByUserId: input.createdByUserId,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  async function update(
    id: string,
    data: Updateable<DB["modNote"]>,
  ): Promise<Selectable<DB["modNote"]> | undefined> {
    return await db
      .updateTable("modNote")
      .set(data)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst()
  }

  async function deleteOne(id: string): Promise<boolean> {
    const result = await db.deleteFrom("modNote").where("id", "=", id).executeTakeFirst()
    return (result.numDeletedRows ?? 0n) > 0n
  }

  return { create, update, deleteOne }
}
