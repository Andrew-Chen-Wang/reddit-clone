import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export function fetchCommunityBan(db: Kysely<DB>) {
  async function isBanned(communityId: string, userId: string): Promise<boolean> {
    const now = new Date()
    const row = await db
      .selectFrom("communityBan")
      .select("id")
      .where("communityId", "=", communityId)
      .where("userId", "=", userId)
      .where((eb) => eb.or([eb("expiresAt", "is", null), eb("expiresAt", ">", now)]))
      .executeTakeFirst()
    return row !== undefined
  }

  async function getActive(communityId: string, userId: string) {
    const now = new Date()
    return await db
      .selectFrom("communityBan")
      .select([
        "id",
        "communityRuleId",
        "modNote",
        "messageToUser",
        "expiresAt",
        "bannedByUserId",
        "createdAt",
      ])
      .where("communityId", "=", communityId)
      .where("userId", "=", userId)
      .where((eb) => eb.or([eb("expiresAt", "is", null), eb("expiresAt", ">", now)]))
      .executeTakeFirst()
  }

  async function listForCommunity(communityId: string) {
    const now = new Date()
    return await db
      .selectFrom("communityBan")
      .innerJoin("user", "user.id", "communityBan.userId")
      .where("communityBan.communityId", "=", communityId)
      .where((eb) =>
        eb.or([eb("communityBan.expiresAt", "is", null), eb("communityBan.expiresAt", ">", now)]),
      )
      .select([
        "communityBan.userId as userId",
        "user.username as username",
        "user.avatarImageKey as avatarImageKey",
        "communityBan.communityRuleId as communityRuleId",
        "communityBan.modNote as modNote",
        "communityBan.messageToUser as messageToUser",
        "communityBan.expiresAt as expiresAt",
        "communityBan.createdAt as createdAt",
      ])
      .orderBy("communityBan.createdAt", "desc")
      .execute()
  }

  return { isBanned, getActive, listForCommunity }
}
