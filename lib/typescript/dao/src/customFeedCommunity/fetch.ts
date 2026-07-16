import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export type CustomFeedCommunityRow = {
  customFeedId: string
  communityId: string
  name: string
  displayName: string | null
  iconImageKey: string | null
  visibility: string
}

export function fetchCustomFeedCommunity(db: Kysely<DB>) {
  async function listCommunityIds(customFeedId: string): Promise<string[]> {
    const rows = await db
      .selectFrom("customFeedCommunity")
      .select("communityId")
      .where("customFeedId", "=", customFeedId)
      .execute()
    return rows.map((r) => r.communityId)
  }

  async function countForFeed(customFeedId: string): Promise<number> {
    const row = await db
      .selectFrom("customFeedCommunity")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("customFeedId", "=", customFeedId)
      .executeTakeFirst()
    return Number(row?.count ?? 0)
  }

  async function exists(customFeedId: string, communityId: string): Promise<boolean> {
    const row = await db
      .selectFrom("customFeedCommunity")
      .select("communityId")
      .where("customFeedId", "=", customFeedId)
      .where("communityId", "=", communityId)
      .executeTakeFirst()
    return row !== undefined
  }

  async function listForFeeds(feedIds: string[]): Promise<CustomFeedCommunityRow[]> {
    if (feedIds.length === 0) return []
    return await db
      .selectFrom("customFeedCommunity")
      .innerJoin("community", "community.id", "customFeedCommunity.communityId")
      .where("customFeedCommunity.customFeedId", "in", feedIds)
      .select([
        "customFeedCommunity.customFeedId as customFeedId",
        "community.id as communityId",
        "community.name as name",
        "community.displayName as displayName",
        "community.iconImageKey as iconImageKey",
        "community.visibility as visibility",
      ])
      .orderBy((eb) => eb.fn("lower", ["community.name"]), "asc")
      .execute()
  }

  return { listCommunityIds, countForFeed, exists, listForFeeds }
}
