import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export function crudUserMutedCommunity(db: Kysely<DB>) {
  async function mute(userId: string, communityId: string): Promise<void> {
    await db
      .insertInto("userMutedCommunity")
      .values({ userId, communityId })
      .onConflict((oc) => oc.columns(["userId", "communityId"]).doNothing())
      .execute()
  }

  async function unmute(userId: string, communityId: string): Promise<boolean> {
    const result = await db
      .deleteFrom("userMutedCommunity")
      .where("userId", "=", userId)
      .where("communityId", "=", communityId)
      .executeTakeFirst()
    return (result.numDeletedRows ?? 0n) > 0n
  }

  return { mute, unmute }
}
