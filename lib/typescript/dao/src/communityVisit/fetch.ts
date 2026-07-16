import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export interface RecentVisitedCommunity {
  communityId: string
  name: string
  iconImageKey: string | null
  lastVisitedAt: string
}

export function fetchCommunityVisit(db: Kysely<DB>) {
  async function getRecentForUser(
    userId: string,
    limit: number,
  ): Promise<RecentVisitedCommunity[]> {
    const rows = await db
      .selectFrom("communityVisit")
      .innerJoin("community", "community.id", "communityVisit.communityId")
      .where("communityVisit.userId", "=", userId)
      .select([
        "community.id as communityId",
        "community.name as name",
        "community.iconImageKey as iconImageKey",
        "communityVisit.lastVisitedAt as lastVisitedAt",
      ])
      .orderBy("communityVisit.lastVisitedAt", "desc")
      .limit(limit)
      .execute()

    return rows.map((r) => ({
      communityId: r.communityId,
      name: r.name,
      iconImageKey: r.iconImageKey,
      lastVisitedAt: r.lastVisitedAt.toISOString(),
    }))
  }

  return { getRecentForUser }
}
