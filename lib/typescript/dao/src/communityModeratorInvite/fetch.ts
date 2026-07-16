import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

export function fetchCommunityModeratorInvite(db: Kysely<DB>) {
  async function getOne<T extends (keyof DB["communityModeratorInvite"])[]>(
    id: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["communityModeratorInvite"]>, T[number]> | undefined> {
    return await db
      .selectFrom("communityModeratorInvite")
      .select(fields)
      .where("id", "=", id)
      .executeTakeFirst()
  }

  async function hasPending(communityId: string, inviteeUserId: string): Promise<boolean> {
    const row = await db
      .selectFrom("communityModeratorInvite")
      .select("id")
      .where("communityId", "=", communityId)
      .where("inviteeUserId", "=", inviteeUserId)
      .where("status", "=", "pending")
      .executeTakeFirst()
    return row !== undefined
  }

  async function getPendingForCommunity(communityId: string) {
    return await db
      .selectFrom("communityModeratorInvite")
      .innerJoin("user", "user.id", "communityModeratorInvite.inviteeUserId")
      .where("communityModeratorInvite.communityId", "=", communityId)
      .where("communityModeratorInvite.status", "=", "pending")
      .select([
        "communityModeratorInvite.id as id",
        "communityModeratorInvite.inviteeUserId as inviteeUserId",
        "user.username as username",
        "user.avatarImageKey as avatarImageKey",
        "communityModeratorInvite.permEverything as permEverything",
        "communityModeratorInvite.permUsers as permUsers",
        "communityModeratorInvite.permConfig as permConfig",
        "communityModeratorInvite.permFlair as permFlair",
        "communityModeratorInvite.permMail as permMail",
        "communityModeratorInvite.permPostsComments as permPostsComments",
        "communityModeratorInvite.permWiki as permWiki",
        "communityModeratorInvite.createdAt as createdAt",
      ])
      .orderBy("communityModeratorInvite.createdAt", "desc")
      .execute()
  }

  async function getPendingForUser(inviteeUserId: string) {
    return await db
      .selectFrom("communityModeratorInvite")
      .innerJoin("community", "community.id", "communityModeratorInvite.communityId")
      .where("communityModeratorInvite.inviteeUserId", "=", inviteeUserId)
      .where("communityModeratorInvite.status", "=", "pending")
      .select([
        "communityModeratorInvite.id as id",
        "community.id as communityId",
        "community.name as communityName",
        "community.displayName as communityDisplayName",
        "community.iconImageKey as iconImageKey",
        "communityModeratorInvite.createdAt as createdAt",
      ])
      .orderBy("communityModeratorInvite.createdAt", "desc")
      .execute()
  }

  return { getOne, hasPending, getPendingForCommunity, getPendingForUser }
}
