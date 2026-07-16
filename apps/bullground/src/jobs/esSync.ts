import { fetchComment } from "@lib/dao/comment/fetch"
import { fetchCommunity } from "@lib/dao/community/fetch"
import { fetchPost } from "@lib/dao/post/fetch"
import { fetchTopic } from "@lib/dao/topic/fetch"
import { fetchUser } from "@lib/dao/user/fetch"
import { fetchUserSettings } from "@lib/dao/userSettings/fetch"
import { db } from "@template-nextjs/db"
import {
  client,
  COMMUNITY_INDEX,
  type CommunityDocument,
  deleteComment,
  deleteCommunity,
  deletePost,
  deleteUser,
  indexComment,
  indexCommunity,
  indexPost,
  indexUser,
  markdownToText,
} from "@template-nextjs/search"
import type { JobPayloadMap } from "@utils/queues"

const BODY_TEXT_MAX = 4000
const CHILD_BATCH = 500

async function currentIndexedVisibility(communityId: string): Promise<string | null> {
  const res = await client.get<CommunityDocument>(
    { index: COMMUNITY_INDEX, id: communityId },
    { ignore: [404] },
  )
  return res.found ? (res._source?.visibility ?? null) : null
}

async function reindexCommunityChildren(communityId: string): Promise<void> {
  let lastPostId = ""
  for (;;) {
    const posts = await db
      .selectFrom("post")
      .select("id")
      .where("communityId", "=", communityId)
      .$if(lastPostId !== "", (qb) => qb.where("id", ">", lastPostId))
      .orderBy("id", "asc")
      .limit(CHILD_BATCH)
      .execute()
    if (posts.length === 0) break
    for (const p of posts) await syncPost(p.id)
    lastPostId = posts[posts.length - 1].id
    if (posts.length < CHILD_BATCH) break
  }

  let lastCommentId = ""
  for (;;) {
    const comments = await db
      .selectFrom("comment")
      .innerJoin("post", "post.id", "comment.postId")
      .select("comment.id as id")
      .where("post.communityId", "=", communityId)
      .$if(lastCommentId !== "", (qb) => qb.where("comment.id", ">", lastCommentId))
      .orderBy("comment.id", "asc")
      .limit(CHILD_BATCH)
      .execute()
    if (comments.length === 0) break
    for (const cm of comments) await syncComment(cm.id)
    lastCommentId = comments[comments.length - 1].id
    if (comments.length < CHILD_BATCH) break
  }
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null
}

export async function syncPost(postId: string): Promise<void> {
  const post = await fetchPost(db).getOne(postId, [
    "id",
    "title",
    "bodyMd",
    "type",
    "communityId",
    "authorUserId",
    "isNsfw",
    "score",
    "commentCount",
    "hotScore",
    "createdAt",
    "removedAt",
  ])
  if (!post || post.removedAt) {
    await deletePost(postId)
    return
  }

  const community = post.communityId
    ? await fetchCommunity(db).getOne(post.communityId, ["name", "visibility"])
    : null
  const author = await fetchUser(db).getOne(post.authorUserId, ["username"])

  await indexPost(post.id, {
    title: post.title,
    body_text: markdownToText(post.bodyMd, BODY_TEXT_MAX),
    type: post.type,
    community_id: post.communityId,
    community_name: community?.name ?? null,
    community_visibility: community?.visibility ?? "public",
    author_username: author?.username ?? "",
    is_nsfw: post.isNsfw,
    score: post.score,
    comment_count: post.commentCount,
    hot_score: post.hotScore,
    created_at: toIso(post.createdAt),
  })
}

export async function syncComment(commentId: string): Promise<void> {
  const comment = await fetchComment(db).getOne(commentId, [
    "id",
    "postId",
    "authorUserId",
    "bodyMd",
    "isDeleted",
    "removedAt",
    "score",
    "createdAt",
  ])
  if (!comment || comment.isDeleted || comment.removedAt || !comment.bodyMd) {
    await deleteComment(commentId)
    return
  }

  const post = await fetchPost(db).getOne(comment.postId, [
    "title",
    "communityId",
    "isNsfw",
    "removedAt",
  ])
  if (!post || post.removedAt) {
    await deleteComment(commentId)
    return
  }

  const community = post.communityId
    ? await fetchCommunity(db).getOne(post.communityId, ["name", "visibility"])
    : null
  const author = comment.authorUserId
    ? await fetchUser(db).getOne(comment.authorUserId, ["username"])
    : null

  await indexComment(comment.id, {
    post_id: comment.postId,
    post_title: post.title,
    body_text: markdownToText(comment.bodyMd, BODY_TEXT_MAX),
    community_id: post.communityId,
    community_name: community?.name ?? null,
    community_visibility: community?.visibility ?? "public",
    author_username: author?.username ?? null,
    is_nsfw: post.isNsfw,
    score: comment.score,
    created_at: toIso(comment.createdAt),
  })
}

export async function syncCommunity(communityId: string): Promise<void> {
  const community = await fetchCommunity(db).getOne(communityId, [
    "id",
    "name",
    "displayName",
    "description",
    "visibility",
    "memberCount",
    "isNsfw",
    "topicId",
    "appearInRecommendations",
  ])
  if (!community) {
    await deleteCommunity(communityId)
    return
  }

  let topicSlug: string | null = null
  if (community.topicId) {
    const topics = await fetchTopic(db).getMany(["id", "slug"])
    topicSlug = topics.find((t) => t.id === community.topicId)?.slug ?? null
  }

  const previousVisibility = await currentIndexedVisibility(community.id)

  await indexCommunity(community.id, {
    name: community.name,
    display_name: community.displayName,
    description: community.description,
    visibility: community.visibility,
    member_count: community.memberCount,
    is_nsfw: community.isNsfw,
    topic_slug: topicSlug,
    appear_in_recommendations: community.appearInRecommendations,
  })

  if (previousVisibility !== null && previousVisibility !== community.visibility) {
    await reindexCommunityChildren(community.id)
  }
}

export async function syncUser(userId: string): Promise<void> {
  const user = await fetchUser(db).getOne(userId, [
    "id",
    "username",
    "displayName",
    "about",
    "postKarma",
    "commentKarma",
  ])
  if (!user) {
    await deleteUser(userId)
    return
  }

  const settings = await fetchUserSettings(db).getOne(userId, ["showInSearch"])

  await indexUser(user.id, {
    username: user.username,
    display_name: user.displayName,
    about: user.about,
    karma: user.postKarma + user.commentKarma,
    show_in_search: settings?.showInSearch ?? true,
  })
}

export async function processEsSyncPost(data: JobPayloadMap["es-sync-post"]): Promise<void> {
  await syncPost(data.postId)
}

export async function processEsSyncComment(data: JobPayloadMap["es-sync-comment"]): Promise<void> {
  await syncComment(data.commentId)
}

export async function processEsSyncCommunity(
  data: JobPayloadMap["es-sync-community"],
): Promise<void> {
  await syncCommunity(data.communityId)
}

export async function processEsSyncUser(data: JobPayloadMap["es-sync-user"]): Promise<void> {
  await syncUser(data.userId)
}
