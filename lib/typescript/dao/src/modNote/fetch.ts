import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

export function fetchModNote(db: Kysely<DB>) {
  async function getOne<T extends (keyof DB["modNote"])[]>(
    id: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["modNote"]>, T[number]> | undefined> {
    return await db.selectFrom("modNote").select(fields).where("id", "=", id).executeTakeFirst()
  }

  async function getManyForUser(communityId: string, targetUserId: string) {
    return await db
      .selectFrom("modNote")
      .leftJoin("user", "user.id", "modNote.createdByUserId")
      .where("modNote.communityId", "=", communityId)
      .where("modNote.targetUserId", "=", targetUserId)
      .select([
        "modNote.id as id",
        "modNote.label as label",
        "modNote.note as note",
        "modNote.createdByUserId as createdByUserId",
        "user.username as createdByUsername",
        "modNote.createdAt as createdAt",
      ])
      .orderBy("modNote.createdAt", "desc")
      .execute()
  }

  return { getOne, getManyForUser }
}
