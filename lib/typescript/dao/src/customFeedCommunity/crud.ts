import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export function crudCustomFeedCommunity(db: Kysely<DB>) {
  async function add(customFeedId: string, communityId: string): Promise<void> {
    await db
      .insertInto("customFeedCommunity")
      .values({ customFeedId, communityId })
      .onConflict((oc) => oc.columns(["customFeedId", "communityId"]).doNothing())
      .execute()
  }

  async function remove(customFeedId: string, communityId: string): Promise<boolean> {
    const result = await db
      .deleteFrom("customFeedCommunity")
      .where("customFeedId", "=", customFeedId)
      .where("communityId", "=", communityId)
      .executeTakeFirst()
    return (result.numDeletedRows ?? 0n) > 0n
  }

  return { add, remove }
}
