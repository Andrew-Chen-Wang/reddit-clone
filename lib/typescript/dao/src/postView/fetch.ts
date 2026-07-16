import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export interface RecentViewedPost {
  postId: string
  title: string
  type: string
  communityId: string | null
  communityName: string | null
  communityIconImageKey: string | null
  score: number
  commentCount: number
  viewedAt: string
}

export function fetchPostView(db: Kysely<DB>) {
  async function getRecentForUser(userId: string, limit: number): Promise<RecentViewedPost[]> {
    const rows = await db
      .selectFrom("postView")
      .innerJoin("post", "post.id", "postView.postId")
      .leftJoin("community", "community.id", "post.communityId")
      .where("postView.userId", "=", userId)
      .where("post.removedAt", "is", null)
      .select([
        "post.id as postId",
        "post.title as title",
        "post.type as type",
        "post.communityId as communityId",
        "community.name as communityName",
        "community.iconImageKey as communityIconImageKey",
        "post.score as score",
        "post.commentCount as commentCount",
        "postView.viewedAt as viewedAt",
      ])
      .orderBy("postView.viewedAt", "desc")
      .limit(limit)
      .execute()

    return rows.map((r) => ({
      postId: r.postId,
      title: r.title,
      type: r.type,
      communityId: r.communityId,
      communityName: r.communityName,
      communityIconImageKey: r.communityIconImageKey,
      score: r.score,
      commentCount: r.commentCount,
      viewedAt: r.viewedAt.toISOString(),
    }))
  }

  return { getRecentForUser }
}
