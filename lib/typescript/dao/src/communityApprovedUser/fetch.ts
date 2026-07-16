import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export function fetchCommunityApprovedUser(db: Kysely<DB>) {
  async function isApproved(communityId: string, userId: string): Promise<boolean> {
    const row = await db
      .selectFrom("communityApprovedUser")
      .select("id")
      .where("communityId", "=", communityId)
      .where("userId", "=", userId)
      .executeTakeFirst()
    return row !== undefined
  }

  async function listForCommunity(communityId: string) {
    return await db
      .selectFrom("communityApprovedUser")
      .innerJoin("user", "user.id", "communityApprovedUser.userId")
      .where("communityApprovedUser.communityId", "=", communityId)
      .select([
        "communityApprovedUser.userId as userId",
        "user.username as username",
        "user.avatarImageKey as avatarImageKey",
        "communityApprovedUser.createdAt as createdAt",
      ])
      .orderBy("communityApprovedUser.createdAt", "desc")
      .execute()
  }

  return { isApproved, listForCommunity }
}
