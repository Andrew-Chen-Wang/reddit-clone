import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export type RelatedCommunityRow = {
  id: string
  name: string
  displayName: string | null
  iconImageKey: string | null
  memberCount: number
  position: number
}

export function fetchCommunityRelated(db: Kysely<DB>) {
  async function listForCommunity(communityId: string): Promise<RelatedCommunityRow[]> {
    return await db
      .selectFrom("communityRelated")
      .innerJoin("community", "community.id", "communityRelated.relatedCommunityId")
      .where("communityRelated.communityId", "=", communityId)
      .select([
        "community.id as id",
        "community.name as name",
        "community.displayName as displayName",
        "community.iconImageKey as iconImageKey",
        "community.memberCount as memberCount",
        "communityRelated.position as position",
      ])
      .orderBy("communityRelated.position", "asc")
      .execute()
  }

  return { listForCommunity }
}
