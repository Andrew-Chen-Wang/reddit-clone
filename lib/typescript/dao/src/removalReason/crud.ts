import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable, Updateable } from "kysely"
import { v7 } from "uuid"

interface CreateRemovalReasonInput {
  communityId: string
  title: string
  message: string
  position: number
}

export function crudRemovalReason(db: Kysely<DB>) {
  async function create(input: CreateRemovalReasonInput): Promise<Selectable<DB["removalReason"]>> {
    return await db
      .insertInto("removalReason")
      .values({
        id: v7(),
        communityId: input.communityId,
        title: input.title,
        message: input.message,
        position: input.position,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  async function update(
    id: string,
    data: Updateable<DB["removalReason"]>,
  ): Promise<Selectable<DB["removalReason"]> | undefined> {
    return await db
      .updateTable("removalReason")
      .set(data)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst()
  }

  async function deleteOne(id: string): Promise<boolean> {
    const result = await db.deleteFrom("removalReason").where("id", "=", id).executeTakeFirst()
    return (result.numDeletedRows ?? 0n) > 0n
  }

  async function reorder(communityId: string, orderedIds: string[]): Promise<void> {
    await db.transaction().execute(async (trx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await trx
          .updateTable("removalReason")
          .set({ position: i })
          .where("id", "=", orderedIds[i])
          .where("communityId", "=", communityId)
          .execute()
      }
    })
  }

  return { create, update, deleteOne, reorder }
}
