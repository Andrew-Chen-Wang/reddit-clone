import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"
import { v7 } from "uuid"

export function crudCommunityMember(db: Kysely<DB>) {
  async function join(communityId: string, userId: string): Promise<void> {
    await db.transaction().execute(async (trx) => {
      const existing = await trx
        .selectFrom("communityMember")
        .where("communityId", "=", communityId)
        .where("userId", "=", userId)
        .select("id")
        .executeTakeFirst()
      if (existing) return

      await trx.insertInto("communityMember").values({ id: v7(), communityId, userId }).execute()

      await trx
        .updateTable("community")
        .where("id", "=", communityId)
        .set((eb) => ({ memberCount: eb("memberCount", "+", 1) }))
        .execute()
    })
  }

  async function leave(communityId: string, userId: string): Promise<void> {
    await db.transaction().execute(async (trx) => {
      const result = await trx
        .deleteFrom("communityMember")
        .where("communityId", "=", communityId)
        .where("userId", "=", userId)
        .executeTakeFirst()

      if ((result.numDeletedRows ?? 0n) > 0n) {
        await trx
          .updateTable("community")
          .where("id", "=", communityId)
          .set((eb) => ({ memberCount: eb("memberCount", "-", 1) }))
          .execute()
      }
    })
  }

  async function setFavorite(
    communityId: string,
    userId: string,
    isFavorite: boolean,
  ): Promise<void> {
    await db
      .updateTable("communityMember")
      .set({ isFavorite })
      .where("communityId", "=", communityId)
      .where("userId", "=", userId)
      .execute()
  }

  async function setNotificationLevel(
    communityId: string,
    userId: string,
    notificationLevel: string,
  ): Promise<void> {
    await db
      .updateTable("communityMember")
      .set({ notificationLevel })
      .where("communityId", "=", communityId)
      .where("userId", "=", userId)
      .execute()
  }

  return { join, leave, setFavorite, setNotificationLevel }
}
