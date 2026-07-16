import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export interface SetCommentVoteResult {
  ups: number
  downs: number
  score: number
  userVote: number
}

export function crudCommentVote(db: Kysely<DB>) {
  async function setVote(
    commentId: string,
    userId: string,
    value: number,
  ): Promise<SetCommentVoteResult | undefined> {
    return await db.transaction().execute(async (trx) => {
      const comment = await trx
        .selectFrom("comment")
        .select(["authorUserId"])
        .where("id", "=", commentId)
        .executeTakeFirst()
      if (!comment) return undefined

      const existing = await trx
        .selectFrom("commentVote")
        .select(["value"])
        .where("commentId", "=", commentId)
        .where("userId", "=", userId)
        .executeTakeFirst()

      const oldValue = existing?.value ?? 0
      const newValue = value

      if (newValue === 0) {
        if (existing) {
          await trx
            .deleteFrom("commentVote")
            .where("commentId", "=", commentId)
            .where("userId", "=", userId)
            .execute()
        }
      } else if (existing) {
        await trx
          .updateTable("commentVote")
          .set({ value: newValue, updatedAt: new Date() })
          .where("commentId", "=", commentId)
          .where("userId", "=", userId)
          .execute()
      } else {
        await trx.insertInto("commentVote").values({ commentId, userId, value: newValue }).execute()
      }

      const upDelta = (newValue === 1 ? 1 : 0) - (oldValue === 1 ? 1 : 0)
      const downDelta = (newValue === -1 ? 1 : 0) - (oldValue === -1 ? 1 : 0)
      const scoreDelta = upDelta - downDelta

      const counts = await trx
        .updateTable("comment")
        .set((eb) => ({
          ups: eb("ups", "+", upDelta),
          downs: eb("downs", "+", downDelta),
        }))
        .where("id", "=", commentId)
        .returning(["ups", "downs"])
        .executeTakeFirstOrThrow()

      if (scoreDelta !== 0 && comment.authorUserId) {
        await trx
          .updateTable("user")
          .set((eb) => ({ commentKarma: eb("commentKarma", "+", scoreDelta) }))
          .where("id", "=", comment.authorUserId)
          .execute()
      }

      return {
        ups: counts.ups,
        downs: counts.downs,
        score: counts.ups - counts.downs,
        userVote: newValue,
      }
    })
  }

  return { setVote }
}
