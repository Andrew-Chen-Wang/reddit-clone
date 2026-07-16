import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"
import { v7 } from "uuid"

interface BanInput {
  communityId: string
  userId: string
  communityRuleId?: string | null
  modNote?: string | null
  messageToUser?: string | null
  expiresAt?: Date | null
  bannedByUserId: string | null
}

export function crudCommunityBan(db: Kysely<DB>) {
  async function ban(input: BanInput): Promise<Selectable<DB["communityBan"]>> {
    return await db
      .insertInto("communityBan")
      .values({
        id: v7(),
        communityId: input.communityId,
        userId: input.userId,
        communityRuleId: input.communityRuleId ?? null,
        modNote: input.modNote ?? null,
        messageToUser: input.messageToUser ?? null,
        expiresAt: input.expiresAt ?? null,
        bannedByUserId: input.bannedByUserId,
      })
      .onConflict((oc) =>
        oc.columns(["communityId", "userId"]).doUpdateSet({
          communityRuleId: input.communityRuleId ?? null,
          modNote: input.modNote ?? null,
          messageToUser: input.messageToUser ?? null,
          expiresAt: input.expiresAt ?? null,
          bannedByUserId: input.bannedByUserId,
          createdAt: new Date(),
        }),
      )
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  async function unban(communityId: string, userId: string): Promise<boolean> {
    const result = await db
      .deleteFrom("communityBan")
      .where("communityId", "=", communityId)
      .where("userId", "=", userId)
      .executeTakeFirst()
    return (result.numDeletedRows ?? 0n) > 0n
  }

  return { ban, unban }
}
