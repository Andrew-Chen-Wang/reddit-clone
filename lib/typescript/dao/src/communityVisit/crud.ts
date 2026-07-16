import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export function crudCommunityVisit(db: Kysely<DB>) {
  async function recordVisit(communityId: string, userId: string): Promise<void> {
    await db
      .insertInto("communityVisit")
      .values({ communityId, userId, lastVisitedAt: new Date() })
      .onConflict((oc) =>
        oc.columns(["userId", "communityId"]).doUpdateSet({ lastVisitedAt: new Date() }),
      )
      .execute()
  }

  return { recordVisit }
}
