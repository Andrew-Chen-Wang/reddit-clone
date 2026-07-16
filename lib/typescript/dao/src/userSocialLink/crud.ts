import type { DB } from "@template-nextjs/db"
import type { Insertable, Kysely, Selectable } from "kysely"
import { v7 } from "uuid"
import type { PartialBy } from "../utils/types"

export function crudUserSocialLink(db: Kysely<DB>) {
  async function create(
    data: PartialBy<Insertable<DB["userSocialLink"]>, "id">,
  ): Promise<Selectable<DB["userSocialLink"]>> {
    return await db
      .insertInto("userSocialLink")
      .values({ id: v7(), ...data })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  async function deleteOwn(id: string, userId: string): Promise<boolean> {
    const result = await db
      .deleteFrom("userSocialLink")
      .where("id", "=", id)
      .where("userId", "=", userId)
      .executeTakeFirst()
    return (result.numDeletedRows ?? 0n) > 0n
  }

  return { create, deleteOwn }
}
