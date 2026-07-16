import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export interface ModLogRow {
  id: string
  communityId: string
  action: string
  details: unknown
  createdAt: Date
  modUserId: string | null
  modUsername: string | null
  targetPostId: string | null
  targetPostTitle: string | null
  targetCommentId: string | null
  targetUserId: string | null
  targetUsername: string | null
}

export function fetchModAction(db: Kysely<DB>) {
  async function listForCommunities(
    communityIds: string[],
    limit: number,
    offset: number,
  ): Promise<ModLogRow[]> {
    if (communityIds.length === 0) return []
    return await db
      .selectFrom("modAction")
      .leftJoin("user as modUser", "modUser.id", "modAction.modUserId")
      .leftJoin("post", "post.id", "modAction.targetPostId")
      .leftJoin("comment", "comment.id", "modAction.targetCommentId")
      .leftJoin("user as targetUser", "targetUser.id", "modAction.targetUserId")
      .where("modAction.communityId", "in", communityIds)
      .select([
        "modAction.id as id",
        "modAction.communityId as communityId",
        "modAction.action as action",
        "modAction.details as details",
        "modAction.createdAt as createdAt",
        "modAction.modUserId as modUserId",
        "modUser.username as modUsername",
        "modAction.targetPostId as targetPostId",
        "post.title as targetPostTitle",
        "modAction.targetCommentId as targetCommentId",
        "modAction.targetUserId as targetUserId",
        "targetUser.username as targetUsername",
      ])
      .orderBy("modAction.createdAt", "desc")
      .orderBy("modAction.id", "desc")
      .limit(limit)
      .offset(offset)
      .execute()
  }

  async function hasActionForPost(postId: string): Promise<boolean> {
    const row = await db
      .selectFrom("modAction")
      .select("id")
      .where("targetPostId", "=", postId)
      .executeTakeFirst()
    return row !== undefined
  }

  async function hasActionForComment(commentId: string): Promise<boolean> {
    const row = await db
      .selectFrom("modAction")
      .select("id")
      .where("targetCommentId", "=", commentId)
      .executeTakeFirst()
    return row !== undefined
  }

  return { listForCommunities, hasActionForPost, hasActionForComment }
}
