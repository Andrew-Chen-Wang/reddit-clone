import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable, Updateable } from "kysely"
import { v7 } from "uuid"

interface CreateUserFlairInput {
  communityId: string
  text: string
  bgColor?: string | null
  textColor?: string | null
  modOnly?: boolean
  selfAssignable?: boolean
  position?: number
}

export function crudUserFlairTemplate(db: Kysely<DB>) {
  async function create(input: CreateUserFlairInput): Promise<Selectable<DB["userFlairTemplate"]>> {
    return await db
      .insertInto("userFlairTemplate")
      .values({
        id: v7(),
        communityId: input.communityId,
        text: input.text,
        bgColor: input.bgColor ?? null,
        textColor: input.textColor ?? null,
        modOnly: input.modOnly ?? false,
        selfAssignable: input.selfAssignable ?? true,
        position: input.position ?? 0,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  async function update(
    id: string,
    data: Updateable<DB["userFlairTemplate"]>,
  ): Promise<Selectable<DB["userFlairTemplate"]> | undefined> {
    return await db
      .updateTable("userFlairTemplate")
      .set(data)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst()
  }

  async function deleteOne(id: string): Promise<boolean> {
    const result = await db.deleteFrom("userFlairTemplate").where("id", "=", id).executeTakeFirst()
    return (result.numDeletedRows ?? 0n) > 0n
  }

  return { create, update, deleteOne }
}
