import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

export function fetchCommunityModerator(db: Kysely<DB>) {
  async function getOne<T extends (keyof DB["communityModerator"])[]>(
    communityId: string,
    userId: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["communityModerator"]>, T[number]> | undefined> {
    return await db
      .selectFrom("communityModerator")
      .select(fields)
      .where("communityId", "=", communityId)
      .where("userId", "=", userId)
      .executeTakeFirst()
  }

  async function getManyForCommunity(communityId: string) {
    return await db
      .selectFrom("communityModerator")
      .innerJoin("user", "user.id", "communityModerator.userId")
      .where("communityModerator.communityId", "=", communityId)
      .select([
        "communityModerator.userId as userId",
        "communityModerator.position as position",
        "communityModerator.permEverything as permEverything",
        "communityModerator.permUsers as permUsers",
        "communityModerator.permConfig as permConfig",
        "communityModerator.permFlair as permFlair",
        "communityModerator.permMail as permMail",
        "communityModerator.permPostsComments as permPostsComments",
        "communityModerator.permWiki as permWiki",
        "user.username as username",
        "user.avatarImageKey as avatarImageKey",
      ])
      .orderBy("communityModerator.position", "asc")
      .execute()
  }

  async function getManyForUser(userId: string) {
    return await db
      .selectFrom("communityModerator")
      .innerJoin("community", "community.id", "communityModerator.communityId")
      .where("communityModerator.userId", "=", userId)
      .select([
        "community.id as id",
        "community.name as name",
        "community.displayName as displayName",
        "community.iconImageKey as iconImageKey",
      ])
      .orderBy((eb) => eb.fn("lower", ["community.name"]), "asc")
      .execute()
  }

  return { getOne, getManyForCommunity, getManyForUser }
}
