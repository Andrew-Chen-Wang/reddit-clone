import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

export function fetchPostMedia(db: Kysely<DB>) {
  async function getManyByPost<T extends (keyof DB["postMedia"])[]>(
    postId: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["postMedia"]>, T[number]>[]> {
    return await db
      .selectFrom("postMedia")
      .select(fields)
      .where("postId", "=", postId)
      .orderBy("position", "asc")
      .execute()
  }

  async function getCompletedByPosts<T extends (keyof DB["postMedia"])[]>(
    postIds: string[],
    fields: T,
  ): Promise<Pick<Selectable<DB["postMedia"]>, T[number]>[]> {
    if (postIds.length === 0) return []
    return await db
      .selectFrom("postMedia")
      .select(fields)
      .where("postId", "in", postIds)
      .where("uploadStatus", "=", "completed")
      .orderBy("postId", "asc")
      .orderBy("position", "asc")
      .execute()
  }

  async function countCompletedByPost(postId: string): Promise<number> {
    const row = await db
      .selectFrom("postMedia")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("postId", "=", postId)
      .where("uploadStatus", "=", "completed")
      .executeTakeFirst()
    return Number(row?.count ?? 0)
  }

  return { getManyByPost, getCompletedByPosts, countCompletedByPost }
}
