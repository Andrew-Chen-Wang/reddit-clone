import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable, Updateable } from "kysely"
import { v7 } from "uuid"

interface CreatePostFlairInput {
  communityId: string
  text: string
  bgColor?: string | null
  textColor?: string | null
  modOnly?: boolean
  position?: number
}

export function crudPostFlairTemplate(db: Kysely<DB>) {
  async function create(input: CreatePostFlairInput): Promise<Selectable<DB["postFlairTemplate"]>> {
    return await db
      .insertInto("postFlairTemplate")
      .values({
        id: v7(),
        communityId: input.communityId,
        text: input.text,
        bgColor: input.bgColor ?? null,
        textColor: input.textColor ?? null,
        modOnly: input.modOnly ?? false,
        position: input.position ?? 0,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  async function update(
    id: string,
    data: Updateable<DB["postFlairTemplate"]>,
  ): Promise<Selectable<DB["postFlairTemplate"]> | undefined> {
    return await db
      .updateTable("postFlairTemplate")
      .set(data)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst()
  }

  async function deleteOne(id: string): Promise<boolean> {
    const result = await db.deleteFrom("postFlairTemplate").where("id", "=", id).executeTakeFirst()
    return (result.numDeletedRows ?? 0n) > 0n
  }

  return { create, update, deleteOne }
}
