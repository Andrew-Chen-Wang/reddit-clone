import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export function fetchCommunityMutedUser(db: Kysely<DB>) {
  async function isMuted(communityId: string, userId: string): Promise<boolean> {
    const now = new Date()
    const row = await db
      .selectFrom("communityMutedUser")
      .select("id")
      .where("communityId", "=", communityId)
      .where("userId", "=", userId)
      .where((eb) => eb.or([eb("expiresAt", "is", null), eb("expiresAt", ">", now)]))
      .executeTakeFirst()
    return row !== undefined
  }

  async function listForCommunity(communityId: string) {
    const now = new Date()
    return await db
      .selectFrom("communityMutedUser")
      .innerJoin("user", "user.id", "communityMutedUser.userId")
      .where("communityMutedUser.communityId", "=", communityId)
      .where((eb) =>
        eb.or([
          eb("communityMutedUser.expiresAt", "is", null),
          eb("communityMutedUser.expiresAt", ">", now),
        ]),
      )
      .select([
        "communityMutedUser.userId as userId",
        "user.username as username",
        "user.avatarImageKey as avatarImageKey",
        "communityMutedUser.expiresAt as expiresAt",
        "communityMutedUser.createdAt as createdAt",
      ])
      .orderBy("communityMutedUser.createdAt", "desc")
      .execute()
  }

  return { isMuted, listForCommunity }
}
