import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export function fetchUserFollow(db: Kysely<DB>) {
  async function isFollowing(followerUserId: string, followedUserId: string): Promise<boolean> {
    const row = await db
      .selectFrom("userFollow")
      .select("followedUserId")
      .where("followerUserId", "=", followerUserId)
      .where("followedUserId", "=", followedUserId)
      .executeTakeFirst()
    return row !== undefined
  }

  async function followerCount(userId: string): Promise<number> {
    const row = await db
      .selectFrom("userFollow")
      .where("followedUserId", "=", userId)
      .select((eb) => eb.fn.count<string>("followerUserId").as("count"))
      .executeTakeFirstOrThrow()
    return Number(row.count)
  }

  async function listFollowedIds(userId: string): Promise<string[]> {
    const rows = await db
      .selectFrom("userFollow")
      .select("followedUserId")
      .where("followerUserId", "=", userId)
      .execute()
    return rows.map((r) => r.followedUserId)
  }

  async function listMine(userId: string) {
    return await db
      .selectFrom("userFollow")
      .innerJoin("user", "user.id", "userFollow.followedUserId")
      .where("userFollow.followerUserId", "=", userId)
      .select([
        "user.id as id",
        "user.username as username",
        "user.displayName as displayName",
        "user.avatarImageKey as avatarImageKey",
        "userFollow.createdAt as createdAt",
      ])
      .orderBy("userFollow.createdAt", "desc")
      .execute()
  }

  return { isFollowing, followerCount, listFollowedIds, listMine }
}
