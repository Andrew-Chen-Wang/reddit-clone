import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable, Updateable } from "kysely"
import { v7 } from "uuid"

interface CreateRuleInput {
  communityId: string
  name: string
  description?: string | null
  position: number
}

export function crudCommunityRule(db: Kysely<DB>) {
  async function create(input: CreateRuleInput): Promise<Selectable<DB["communityRule"]>> {
    return await db
      .insertInto("communityRule")
      .values({
        id: v7(),
        communityId: input.communityId,
        name: input.name,
        description: input.description ?? null,
        position: input.position,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  async function update(
    id: string,
    data: Updateable<DB["communityRule"]>,
  ): Promise<Selectable<DB["communityRule"]> | undefined> {
    return await db
      .updateTable("communityRule")
      .set(data)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst()
  }

  async function deleteOne(id: string): Promise<boolean> {
    const result = await db.deleteFrom("communityRule").where("id", "=", id).executeTakeFirst()
    return (result.numDeletedRows ?? 0n) > 0n
  }

  async function reorder(communityId: string, orderedIds: string[]): Promise<void> {
    await db.transaction().execute(async (trx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await trx
          .updateTable("communityRule")
          .set({ position: i })
          .where("id", "=", orderedIds[i])
          .where("communityId", "=", communityId)
          .execute()
      }
    })
  }

  return { create, update, deleteOne, reorder }
}
