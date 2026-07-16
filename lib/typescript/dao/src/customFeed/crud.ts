import type { DB } from "@template-nextjs/db"
import type { Insertable, Kysely, Selectable, Updateable } from "kysely"
import { v7 } from "uuid"
import type { PartialBy } from "../utils/types"

export function crudCustomFeed(db: Kysely<DB>) {
  async function create(
    data: PartialBy<Insertable<DB["customFeed"]>, "id">,
  ): Promise<Selectable<DB["customFeed"]>> {
    return await db
      .insertInto("customFeed")
      .values({ id: v7(), ...data })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  async function update(
    id: string,
    data: Updateable<DB["customFeed"]>,
  ): Promise<Selectable<DB["customFeed"]> | undefined> {
    return await db
      .updateTable("customFeed")
      .set(data)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst()
  }

  async function deleteOne(id: string): Promise<boolean> {
    const result = await db.deleteFrom("customFeed").where("id", "=", id).executeTakeFirst()
    return (result.numDeletedRows ?? 0n) > 0n
  }

  return { create, update, deleteOne }
}
