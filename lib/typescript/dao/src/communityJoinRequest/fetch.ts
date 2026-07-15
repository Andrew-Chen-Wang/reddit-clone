import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

export function fetchCommunityJoinRequest(db: Kysely<DB>) {
  async function getOne<T extends (keyof DB["communityJoinRequest"])[]>(
    id: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["communityJoinRequest"]>, T[number]> | undefined> {
    return await db
      .selectFrom("communityJoinRequest")
      .select(fields)
      .where("id", "=", id)
      .executeTakeFirst()
  }

  async function getOneForUser<T extends (keyof DB["communityJoinRequest"])[]>(
    communityId: string,
    userId: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["communityJoinRequest"]>, T[number]> | undefined> {
    return await db
      .selectFrom("communityJoinRequest")
      .select(fields)
      .where("communityId", "=", communityId)
      .where("userId", "=", userId)
      .where("status", "=", "pending")
      .executeTakeFirst()
  }

  async function getPendingForCommunity(communityId: string) {
    return await db
      .selectFrom("communityJoinRequest")
      .innerJoin("user", "user.id", "communityJoinRequest.userId")
      .where("communityJoinRequest.communityId", "=", communityId)
      .where("communityJoinRequest.status", "=", "pending")
      .select([
        "communityJoinRequest.id as id",
        "communityJoinRequest.message as message",
        "communityJoinRequest.createdAt as createdAt",
        "user.id as userId",
        "user.username as username",
        "user.avatarImageKey as avatarImageKey",
      ])
      .orderBy("communityJoinRequest.createdAt", "asc")
      .execute()
  }

  return { getOne, getOneForUser, getPendingForCommunity }
}
