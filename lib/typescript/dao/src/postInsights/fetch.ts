import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export interface InsightTopComment {
  id: string
  snippet: string
  score: number
  authorUsername: string | null
}

export function fetchPostInsights(db: Kysely<DB>) {
  async function countCrossposts(postId: string): Promise<number> {
    const row = await db
      .selectFrom("post")
      .where("crosspostOfPostId", "=", postId)
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .executeTakeFirst()
    return row ? Number(row.count) : 0
  }

  async function topComments(postId: string, limit: number): Promise<InsightTopComment[]> {
    const rows = await db
      .selectFrom("comment")
      .leftJoin("user", "user.id", "comment.authorUserId")
      .where("comment.postId", "=", postId)
      .where("comment.isDeleted", "=", false)
      .where("comment.removedAt", "is", null)
      .select([
        "comment.id as id",
        "comment.bodyMd as bodyMd",
        "comment.score as score",
        "user.username as authorUsername",
      ])
      .orderBy("comment.score", "desc")
      .orderBy("comment.id", "asc")
      .limit(limit)
      .execute()

    return rows.map((r) => ({
      id: r.id,
      snippet: snippetOf(r.bodyMd),
      score: r.score,
      authorUsername: r.authorUsername,
    }))
  }

  async function rankAllTime(authorUserId: string, score: number): Promise<number> {
    const row = await db
      .selectFrom("post")
      .where("authorUserId", "=", authorUserId)
      .where("score", ">", score)
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .executeTakeFirst()
    return (row ? Number(row.count) : 0) + 1
  }

  async function rankInCommunityToday(
    communityId: string,
    score: number,
    since: Date,
  ): Promise<number> {
    const row = await db
      .selectFrom("post")
      .where("communityId", "=", communityId)
      .where("createdAt", ">=", since)
      .where("score", ">", score)
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .executeTakeFirst()
    return (row ? Number(row.count) : 0) + 1
  }

  return { countCrossposts, topComments, rankAllTime, rankInCommunityToday }
}

const SNIPPET_MAX = 140

function snippetOf(body: string | null): string {
  if (!body) return ""
  const collapsed = body.replace(/\s+/g, " ").trim()
  return collapsed.length > SNIPPET_MAX ? `${collapsed.slice(0, SNIPPET_MAX)}…` : collapsed
}
