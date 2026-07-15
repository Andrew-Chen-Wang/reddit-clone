import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"
import { v7 } from "uuid"

export function crudCommunityUserFlair(db: Kysely<DB>) {
  async function upsert(
    communityId: string,
    userId: string,
    userFlairTemplateId: string | null,
    customText: string | null,
  ): Promise<void> {
    await db
      .insertInto("communityUserFlair")
      .values({ id: v7(), communityId, userId, userFlairTemplateId, customText })
      .onConflict((oc) =>
        oc.columns(["communityId", "userId"]).doUpdateSet({ userFlairTemplateId, customText }),
      )
      .execute()
  }

  async function clear(communityId: string, userId: string): Promise<void> {
    await db
      .deleteFrom("communityUserFlair")
      .where("communityId", "=", communityId)
      .where("userId", "=", userId)
      .execute()
  }

  return { upsert, clear }
}
