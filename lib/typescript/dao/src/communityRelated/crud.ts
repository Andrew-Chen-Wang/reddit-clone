import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export function crudCommunityRelated(db: Kysely<DB>) {
  async function setList(communityId: string, relatedCommunityIds: string[]): Promise<void> {
    await db.transaction().execute(async (trx) => {
      await trx.deleteFrom("communityRelated").where("communityId", "=", communityId).execute()
      if (relatedCommunityIds.length === 0) return
      await trx
        .insertInto("communityRelated")
        .values(
          relatedCommunityIds.map((relatedCommunityId, position) => ({
            communityId,
            relatedCommunityId,
            position,
          })),
        )
        .execute()
    })
  }

  return { setList }
}
