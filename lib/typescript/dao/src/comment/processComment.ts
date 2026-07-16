import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"
import type { RawCommentRow } from "./fetch"

export interface ProcessedCommentAuthor {
  id: string
  username: string
  displayName: string | null
  avatarImageKey: string | null
  isAdmin: boolean
}

export interface ProcessedComment {
  id: string
  postId: string
  parentCommentId: string | null
  depth: number
  path: string[]
  bodyMd: string | null
  ups: number
  downs: number
  score: number
  childCount: number
  fetchedChildCount: number
  isSticky: boolean
  isDeleted: boolean
  removedByMod: boolean
  createdAt: string
  editedAt: string | null
  userVote: number
  isAuthor: boolean
  author: ProcessedCommentAuthor | null
}

function unique(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => v !== null))]
}

export async function processComments(
  db: Kysely<DB>,
  rows: RawCommentRow[],
  viewerId: string | null,
  viewerIsMod = false,
): Promise<ProcessedComment[]> {
  if (rows.length === 0) return []

  const commentIds = rows.map((r) => r.id)
  const authorIds = unique(rows.map((r) => r.authorUserId))

  const [voteRows, authorRows] = await Promise.all([
    viewerId
      ? db
          .selectFrom("commentVote")
          .select(["commentId", "value"])
          .where("userId", "=", viewerId)
          .where("commentId", "in", commentIds)
          .execute()
      : Promise.resolve([] as { commentId: string; value: number }[]),
    authorIds.length
      ? db
          .selectFrom("user")
          .select(["id", "username", "displayName", "avatarImageKey", "isAdmin"])
          .where("id", "in", authorIds)
          .execute()
      : Promise.resolve([] as ProcessedCommentAuthor[]),
  ])

  const voteByComment = new Map(voteRows.map((v) => [v.commentId, v.value]))
  const authorById = new Map(authorRows.map((a) => [a.id, a]))

  const fetchedChildCount = new Map<string, number>()
  for (const r of rows) {
    if (r.parentCommentId === null) continue
    fetchedChildCount.set(r.parentCommentId, (fetchedChildCount.get(r.parentCommentId) ?? 0) + 1)
  }

  return rows.map((r) => {
    const removedByMod = r.removedAt !== null
    const author = r.authorUserId ? (authorById.get(r.authorUserId) ?? null) : null
    const bodyMd = removedByMod && !viewerIsMod ? null : r.bodyMd
    return {
      id: r.id,
      postId: r.postId,
      parentCommentId: r.parentCommentId,
      depth: r.depth,
      path: r.path,
      bodyMd,
      ups: r.ups,
      downs: r.downs,
      score: r.score,
      childCount: r.childCount,
      fetchedChildCount: fetchedChildCount.get(r.id) ?? 0,
      isSticky: r.isSticky,
      isDeleted: r.isDeleted,
      removedByMod,
      createdAt: r.createdAt.toISOString(),
      editedAt: r.editedAt ? r.editedAt.toISOString() : null,
      userVote: voteByComment.get(r.id) ?? 0,
      isAuthor: viewerId !== null && r.authorUserId === viewerId,
      author: author
        ? {
            id: author.id,
            username: author.username,
            displayName: author.displayName,
            avatarImageKey: author.avatarImageKey,
            isAdmin: author.isAdmin,
          }
        : null,
    }
  })
}
