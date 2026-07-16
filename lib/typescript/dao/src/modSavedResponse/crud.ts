import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable, Updateable } from "kysely"
import { v7 } from "uuid"

interface CreateSavedResponseInput {
  communityId: string
  title: string
  bodyMd: string
  createdByUserId: string | null
}

export function crudModSavedResponse(db: Kysely<DB>) {
  async function create(
    input: CreateSavedResponseInput,
  ): Promise<Selectable<DB["modSavedResponse"]>> {
    return await db
      .insertInto("modSavedResponse")
      .values({
        id: v7(),
        communityId: input.communityId,
        title: input.title,
        bodyMd: input.bodyMd,
        createdByUserId: input.createdByUserId,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  async function update(
    id: string,
    data: Updateable<DB["modSavedResponse"]>,
  ): Promise<Selectable<DB["modSavedResponse"]> | undefined> {
    return await db
      .updateTable("modSavedResponse")
      .set(data)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst()
  }

  async function deleteOne(id: string): Promise<boolean> {
    const result = await db.deleteFrom("modSavedResponse").where("id", "=", id).executeTakeFirst()
    return (result.numDeletedRows ?? 0n) > 0n
  }

  return { create, update, deleteOne }
}
