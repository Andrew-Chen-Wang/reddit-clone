import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable, Updateable } from "kysely"
import { v7 } from "uuid"

interface CreateBookmarkInput {
  communityId: string
  label: string
  url: string
  position: number
}

export function crudCommunityBookmark(db: Kysely<DB>) {
  async function create(input: CreateBookmarkInput): Promise<Selectable<DB["communityBookmark"]>> {
    return await db
      .insertInto("communityBookmark")
      .values({
        id: v7(),
        communityId: input.communityId,
        label: input.label,
        url: input.url,
        position: input.position,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  async function update(
    id: string,
    data: Updateable<DB["communityBookmark"]>,
  ): Promise<Selectable<DB["communityBookmark"]> | undefined> {
    return await db
      .updateTable("communityBookmark")
      .set(data)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst()
  }

  async function deleteOne(id: string): Promise<boolean> {
    const result = await db.deleteFrom("communityBookmark").where("id", "=", id).executeTakeFirst()
    return (result.numDeletedRows ?? 0n) > 0n
  }

  async function reorder(communityId: string, orderedIds: string[]): Promise<void> {
    await db.transaction().execute(async (trx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await trx
          .updateTable("communityBookmark")
          .set({ position: i })
          .where("id", "=", orderedIds[i])
          .where("communityId", "=", communityId)
          .execute()
      }
    })
  }

  return { create, update, deleteOne, reorder }
}
