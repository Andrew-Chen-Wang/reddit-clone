import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export function fetchUserMutedCommunity(db: Kysely<DB>) {
  async function isMuted(userId: string, communityId: string): Promise<boolean> {
    const row = await db
      .selectFrom("userMutedCommunity")
      .select("communityId")
      .where("userId", "=", userId)
      .where("communityId", "=", communityId)
      .executeTakeFirst()
    return row !== undefined
  }

  async function count(userId: string): Promise<number> {
    const row = await db
      .selectFrom("userMutedCommunity")
      .where("userId", "=", userId)
      .select((eb) => eb.fn.count<string>("communityId").as("count"))
      .executeTakeFirstOrThrow()
    return Number(row.count)
  }

  async function listMine(userId: string) {
    return await db
      .selectFrom("userMutedCommunity")
      .innerJoin("community", "community.id", "userMutedCommunity.communityId")
      .where("userMutedCommunity.userId", "=", userId)
      .select([
        "community.id as id",
        "community.name as name",
        "community.displayName as displayName",
        "community.iconImageKey as iconImageKey",
        "userMutedCommunity.createdAt as createdAt",
      ])
      .orderBy("userMutedCommunity.createdAt", "desc")
      .execute()
  }

  return { isMuted, count, listMine }
}
