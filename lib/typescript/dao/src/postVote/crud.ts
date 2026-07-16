import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export interface SetVoteResult {
  ups: number
  downs: number
  score: number
  userVote: number
}

export function crudPostVote(db: Kysely<DB>) {
  async function setVote(
    postId: string,
    userId: string,
    value: number,
  ): Promise<SetVoteResult | undefined> {
    return await db.transaction().execute(async (trx) => {
      const post = await trx
        .selectFrom("post")
        .select(["authorUserId"])
        .where("id", "=", postId)
        .executeTakeFirst()
      if (!post) return undefined

      const existing = await trx
        .selectFrom("postVote")
        .select(["value"])
        .where("postId", "=", postId)
        .where("userId", "=", userId)
        .executeTakeFirst()

      const oldValue = existing?.value ?? 0
      const newValue = value

      if (newValue === 0) {
        if (existing) {
          await trx
            .deleteFrom("postVote")
            .where("postId", "=", postId)
            .where("userId", "=", userId)
            .execute()
        }
      } else if (existing) {
        await trx
          .updateTable("postVote")
          .set({ value: newValue, updatedAt: new Date() })
          .where("postId", "=", postId)
          .where("userId", "=", userId)
          .execute()
      } else {
        await trx.insertInto("postVote").values({ postId, userId, value: newValue }).execute()
      }

      const upDelta = (newValue === 1 ? 1 : 0) - (oldValue === 1 ? 1 : 0)
      const downDelta = (newValue === -1 ? 1 : 0) - (oldValue === -1 ? 1 : 0)
      const scoreDelta = upDelta - downDelta

      const counts = await trx
        .updateTable("post")
        .set((eb) => ({
          ups: eb("ups", "+", upDelta),
          downs: eb("downs", "+", downDelta),
        }))
        .where("id", "=", postId)
        .returning(["ups", "downs"])
        .executeTakeFirstOrThrow()

      if (scoreDelta !== 0) {
        await trx
          .updateTable("user")
          .set((eb) => ({ postKarma: eb("postKarma", "+", scoreDelta) }))
          .where("id", "=", post.authorUserId)
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
