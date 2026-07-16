import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"
import { v7 } from "uuid"

export function crudCommunityApprovedUser(db: Kysely<DB>) {
  async function approve(
    communityId: string,
    userId: string,
    approvedByUserId: string | null,
  ): Promise<void> {
    await db
      .insertInto("communityApprovedUser")
      .values({ id: v7(), communityId, userId, approvedByUserId })
      .onConflict((oc) => oc.columns(["communityId", "userId"]).doNothing())
      .execute()
  }

  async function unapprove(communityId: string, userId: string): Promise<boolean> {
    const result = await db
      .deleteFrom("communityApprovedUser")
      .where("communityId", "=", communityId)
      .where("userId", "=", userId)
      .executeTakeFirst()
    return (result.numDeletedRows ?? 0n) > 0n
  }

  return { approve, unapprove }
}
