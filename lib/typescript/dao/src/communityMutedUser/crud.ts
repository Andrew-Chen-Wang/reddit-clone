import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"
import { v7 } from "uuid"

interface MuteInput {
  communityId: string
  userId: string
  expiresAt?: Date | null
  mutedByUserId: string | null
}

export function crudCommunityMutedUser(db: Kysely<DB>) {
  async function mute(input: MuteInput): Promise<void> {
    await db
      .insertInto("communityMutedUser")
      .values({
        id: v7(),
        communityId: input.communityId,
        userId: input.userId,
        expiresAt: input.expiresAt ?? null,
        mutedByUserId: input.mutedByUserId,
      })
      .onConflict((oc) =>
        oc.columns(["communityId", "userId"]).doUpdateSet({
          expiresAt: input.expiresAt ?? null,
          mutedByUserId: input.mutedByUserId,
          createdAt: new Date(),
        }),
      )
      .execute()
  }

  async function unmute(communityId: string, userId: string): Promise<boolean> {
    const result = await db
      .deleteFrom("communityMutedUser")
      .where("communityId", "=", communityId)
      .where("userId", "=", userId)
      .executeTakeFirst()
    return (result.numDeletedRows ?? 0n) > 0n
  }

  return { mute, unmute }
}
