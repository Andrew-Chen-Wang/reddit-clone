import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"
import { v7 } from "uuid"

interface LogInput {
  communityId: string
  modUserId: string | null
  action: string
  targetPostId?: string | null
  targetCommentId?: string | null
  targetUserId?: string | null
  details?: Record<string, unknown> | null
}

export function crudModAction(db: Kysely<DB>) {
  async function log(input: LogInput): Promise<void> {
    await db
      .insertInto("modAction")
      .values({
        id: v7(),
        communityId: input.communityId,
        modUserId: input.modUserId,
        action: input.action,
        targetPostId: input.targetPostId ?? null,
        targetCommentId: input.targetCommentId ?? null,
        targetUserId: input.targetUserId ?? null,
        details: (input.details ?? null) as never,
      })
      .execute()
  }

  return { log }
}
