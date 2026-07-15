import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"
import { v7 } from "uuid"

export function crudCommunityJoinRequest(db: Kysely<DB>) {
  async function create(
    communityId: string,
    userId: string,
    message: string | null,
  ): Promise<{ id: string }> {
    const existing = await db
      .selectFrom("communityJoinRequest")
      .where("communityId", "=", communityId)
      .where("userId", "=", userId)
      .where("status", "=", "pending")
      .select("id")
      .executeTakeFirst()
    if (existing) return existing

    const id = v7()
    await db
      .insertInto("communityJoinRequest")
      .values({ id, communityId, userId, message, status: "pending" })
      .execute()
    return { id }
  }

  async function resolve(
    requestId: string,
    resolvedByUserId: string,
    approve: boolean,
  ): Promise<{ ok: true; communityId: string } | { ok: false }> {
    return await db.transaction().execute(async (trx) => {
      const request = await trx
        .selectFrom("communityJoinRequest")
        .where("id", "=", requestId)
        .select(["communityId", "userId", "status"])
        .executeTakeFirst()
      if (!request || request.status !== "pending") return { ok: false }

      await trx
        .updateTable("communityJoinRequest")
        .set({
          status: approve ? "approved" : "denied",
          resolvedByUserId,
          resolvedAt: new Date(),
        })
        .where("id", "=", requestId)
        .execute()

      if (approve) {
        const existing = await trx
          .selectFrom("communityMember")
          .where("communityId", "=", request.communityId)
          .where("userId", "=", request.userId)
          .select("id")
          .executeTakeFirst()
        if (!existing) {
          await trx
            .insertInto("communityMember")
            .values({ id: v7(), communityId: request.communityId, userId: request.userId })
            .execute()
          await trx
            .updateTable("community")
            .where("id", "=", request.communityId)
            .set((eb) => ({ memberCount: eb("memberCount", "+", 1) }))
            .execute()
        }
      }

      return { ok: true, communityId: request.communityId }
    })
  }

  return { create, resolve }
}
