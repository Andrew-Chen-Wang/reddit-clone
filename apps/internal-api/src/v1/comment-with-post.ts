import type { RawCommentRow } from "@lib/dao/comment/fetch"
import { processComments } from "@lib/dao/comment/processComment"
import { fetchCommunity } from "@lib/dao/community/fetch"
import { fetchPost } from "@lib/dao/post/fetch"
import { db } from "@template-nextjs/db"

export async function buildCommentsWithPost(rows: RawCommentRow[], viewerId: string | null) {
  if (rows.length === 0) return []

  const processed = await processComments(db, rows, viewerId)

  const postIds = [...new Set(rows.map((r) => r.postId))]
  const posts = await fetchPost(db).getManyByIds(postIds, ["id", "title", "communityId"])
  const postById = new Map(posts.map((p) => [p.id, p]))

  const communityIds = [
    ...new Set(posts.map((p) => p.communityId).filter((id): id is string => id !== null)),
  ]
  const communities = await fetchCommunity(db).getManyByIds(communityIds, ["id", "name"])
  const communityById = new Map(communities.map((cm) => [cm.id, cm]))

  return processed.map((comment) => {
    const post = postById.get(comment.postId)
    const community = post?.communityId ? (communityById.get(post.communityId) ?? null) : null
    return {
      id: comment.id,
      postId: comment.postId,
      parentCommentId: comment.parentCommentId,
      depth: comment.depth,
      bodyMd: comment.bodyMd,
      ups: comment.ups,
      downs: comment.downs,
      score: comment.score,
      isDeleted: comment.isDeleted,
      createdAt: comment.createdAt,
      editedAt: comment.editedAt,
      userVote: comment.userVote,
      isAuthor: comment.isAuthor,
      author: comment.author,
      post: {
        id: post?.id ?? comment.postId,
        title: post?.title ?? "",
        community: community ? { id: community.id, name: community.name } : null,
      },
    }
  })
}
