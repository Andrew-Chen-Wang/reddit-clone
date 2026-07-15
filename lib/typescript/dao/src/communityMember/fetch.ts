import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

interface MembershipOverlay {
  isFavorite: boolean
  notificationLevel: string
}

export function fetchCommunityMember(db: Kysely<DB>) {
  async function getOne<T extends (keyof DB["communityMember"])[]>(
    communityId: string,
    userId: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["communityMember"]>, T[number]> | undefined> {
    return await db
      .selectFrom("communityMember")
      .select(fields)
      .where("communityId", "=", communityId)
      .where("userId", "=", userId)
      .executeTakeFirst()
  }

  async function getManyForUser(userId: string) {
    return await db
      .selectFrom("communityMember")
      .innerJoin("community", "community.id", "communityMember.communityId")
      .where("communityMember.userId", "=", userId)
      .select([
        "community.id as id",
        "community.name as name",
        "community.displayName as displayName",
        "community.iconImageKey as iconImageKey",
        "community.visibility as visibility",
        "communityMember.isFavorite as isFavorite",
        "communityMember.notificationLevel as notificationLevel",
      ])
      .orderBy("communityMember.isFavorite", "desc")
      .orderBy((eb) => eb.fn("lower", ["community.name"]), "asc")
      .execute()
  }

  async function getMembershipMap(
    userId: string,
    communityIds: string[],
  ): Promise<Map<string, MembershipOverlay>> {
    if (communityIds.length === 0) return new Map()
    const rows = await db
      .selectFrom("communityMember")
      .where("userId", "=", userId)
      .where("communityId", "in", communityIds)
      .select(["communityId", "isFavorite", "notificationLevel"])
      .execute()
    const map = new Map<string, MembershipOverlay>()
    for (const row of rows) {
      map.set(row.communityId, {
        isFavorite: row.isFavorite,
        notificationLevel: row.notificationLevel,
      })
    }
    return map
  }

  return { getOne, getManyForUser, getMembershipMap }
}
