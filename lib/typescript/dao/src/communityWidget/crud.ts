import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable, Updateable } from "kysely"
import { v7 } from "uuid"

interface CreateWidgetInput {
  communityId: string
  title: string
  bodyMd: string
  position: number
}

export function crudCommunityWidget(db: Kysely<DB>) {
  async function create(input: CreateWidgetInput): Promise<Selectable<DB["communityWidget"]>> {
    return await db
      .insertInto("communityWidget")
      .values({
        id: v7(),
        communityId: input.communityId,
        title: input.title,
        bodyMd: input.bodyMd,
        position: input.position,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  async function update(
    id: string,
    data: Updateable<DB["communityWidget"]>,
  ): Promise<Selectable<DB["communityWidget"]> | undefined> {
    return await db
      .updateTable("communityWidget")
      .set(data)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst()
  }

  async function deleteOne(id: string): Promise<boolean> {
    const result = await db.deleteFrom("communityWidget").where("id", "=", id).executeTakeFirst()
    return (result.numDeletedRows ?? 0n) > 0n
  }

  async function reorder(communityId: string, orderedIds: string[]): Promise<void> {
    await db.transaction().execute(async (trx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await trx
          .updateTable("communityWidget")
          .set({ position: i })
          .where("id", "=", orderedIds[i])
          .where("communityId", "=", communityId)
          .execute()
      }
    })
  }

  return { create, update, deleteOne, reorder }
}
