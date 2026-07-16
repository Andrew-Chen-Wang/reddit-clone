import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"
import { fetchComment } from "../comment/fetch"
import { fetchCommentFollow } from "../commentFollow/fetch"
import { fetchCommunity } from "../community/fetch"
import { fetchPost } from "../post/fetch"
import { fetchPostFollow } from "../postFollow/fetch"
import { fetchRemovalReason } from "../removalReason/fetch"
import { fetchUser } from "../user/fetch"
import { crudNotification } from "./crud"
import type { NotificationType, PreviewSnapshot } from "./types"

const MENTION_RE = /@([A-Za-z0-9_-]{3,20})/g
const MAX_MENTIONS = 3
const PREVIEW_LEN = 280
const TITLE_LEN = 140

export function parseMentions(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const match of text.matchAll(MENTION_RE)) {
    const name = match[1]
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(name)
    if (out.length >= MAX_MENTIONS) break
  }
  return out
}

export function preview(text: string | null | undefined, max: number): string | null {
  if (!text) return null
  const stripped = text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
  if (stripped.length === 0) return null
  if (stripped.length <= max) return stripped
  return `${stripped.slice(0, max - 1).trimEnd()}…`
}

async function loadActorUsername(db: Kysely<DB>, actorUserId: string): Promise<string | null> {
  const actor = await fetchUser(db).getOne(actorUserId, ["username"])
  return actor?.username ?? null
}

async function loadCommunityName(db: Kysely<DB>, communityId: string): Promise<string | null> {
  const community = await fetchCommunity(db).getOne(communityId, ["name"])
  return community?.name ?? null
}

export async function emitCommentReplyAndMentions(
  db: Kysely<DB>,
  args: {
    postId: string
    commentId: string
    parentCommentId: string | null
    actorUserId: string
    bodyMd: string
    communityId: string | null
  },
): Promise<void> {
  const [actorUsername, communityName] = await Promise.all([
    loadActorUsername(db, args.actorUserId),
    args.communityId ? loadCommunityName(db, args.communityId) : Promise.resolve(null),
  ])
  const baseSnapshot: PreviewSnapshot = {
    body: preview(args.bodyMd, PREVIEW_LEN),
    actorUsername,
    communityName,
    postId: args.postId,
    commentId: args.commentId,
  }

  let replyRecipient: string | null = null
  let replyType: NotificationType = "post_reply"
  let replyTitle: string | null = null
  if (args.parentCommentId) {
    const parent = await fetchComment(db).getOne(args.parentCommentId, ["authorUserId"])
    replyType = "comment_reply"
    replyRecipient = parent?.authorUserId ?? null
  } else {
    const post = await fetchPost(db).getOne(args.postId, ["authorUserId", "title"])
    replyType = "post_reply"
    replyRecipient = post?.authorUserId ?? null
    replyTitle = post?.title ?? null
  }

  const claimed = new Set<string>([args.actorUserId])
  if (replyRecipient && !claimed.has(replyRecipient)) {
    claimed.add(replyRecipient)
    await crudNotification(db).emit(replyType, {
      userId: replyRecipient,
      actorUserId: args.actorUserId,
      postId: args.postId,
      commentId: args.commentId,
      communityId: args.communityId,
      previewSnapshot: { ...baseSnapshot, title: replyTitle },
    })
  }

  for (const username of parseMentions(args.bodyMd)) {
    const mentioned = await fetchUser(db).getOneByUsername(username, ["id"])
    if (!mentioned || claimed.has(mentioned.id)) continue
    claimed.add(mentioned.id)
    await crudNotification(db).emit("mention", {
      userId: mentioned.id,
      actorUserId: args.actorUserId,
      postId: args.postId,
      commentId: args.commentId,
      communityId: args.communityId,
      previewSnapshot: baseSnapshot,
    })
  }

  const postFollowerIds = await fetchPostFollow(db).listFollowerIds(args.postId)
  for (const followerId of postFollowerIds) {
    if (claimed.has(followerId)) continue
    claimed.add(followerId)
    await crudNotification(db).emit("post_reply_follow", {
      userId: followerId,
      actorUserId: args.actorUserId,
      postId: args.postId,
      commentId: args.commentId,
      communityId: args.communityId,
      previewSnapshot: { ...baseSnapshot, title: replyTitle },
    })
  }

  if (args.parentCommentId) {
    const commentFollowerIds = await fetchCommentFollow(db).listFollowerIds(args.parentCommentId)
    for (const followerId of commentFollowerIds) {
      if (claimed.has(followerId)) continue
      claimed.add(followerId)
      await crudNotification(db).emit("comment_reply_follow", {
        userId: followerId,
        actorUserId: args.actorUserId,
        postId: args.postId,
        commentId: args.commentId,
        communityId: args.communityId,
        previewSnapshot: baseSnapshot,
      })
    }
  }
}

export async function emitPostUpvoteMilestone(
  db: Kysely<DB>,
  args: {
    postId: string
    authorUserId: string
    actorUserId: string
    ups: number
    title: string
    communityId: string | null
  },
): Promise<void> {
  await crudNotification(db).emit("upvote_post", {
    userId: args.authorUserId,
    actorUserId: args.actorUserId,
    postId: args.postId,
    communityId: args.communityId,
    previewSnapshot: {
      title: preview(args.title, TITLE_LEN),
      postId: args.postId,
      count: args.ups,
    },
  })
}

export async function emitCommentUpvoteMilestone(
  db: Kysely<DB>,
  args: {
    postId: string
    commentId: string
    authorUserId: string
    actorUserId: string
    ups: number
    bodyMd: string | null
    communityId: string | null
  },
): Promise<void> {
  await crudNotification(db).emit("upvote_comment", {
    userId: args.authorUserId,
    actorUserId: args.actorUserId,
    postId: args.postId,
    commentId: args.commentId,
    communityId: args.communityId,
    previewSnapshot: {
      body: preview(args.bodyMd, PREVIEW_LEN),
      postId: args.postId,
      commentId: args.commentId,
      count: args.ups,
    },
  })
}

export async function emitNewFollower(
  db: Kysely<DB>,
  args: { followedUserId: string; actorUserId: string },
): Promise<void> {
  const actorUsername = await loadActorUsername(db, args.actorUserId)
  await crudNotification(db).emit("new_follower", {
    userId: args.followedUserId,
    actorUserId: args.actorUserId,
    previewSnapshot: { actorUsername },
  })
}

export async function emitModInvite(
  db: Kysely<DB>,
  args: { inviteeUserId: string; actorUserId: string; communityId: string },
): Promise<void> {
  const [actorUsername, communityName] = await Promise.all([
    loadActorUsername(db, args.actorUserId),
    loadCommunityName(db, args.communityId),
  ])
  await crudNotification(db).emit("mod_invite", {
    userId: args.inviteeUserId,
    actorUserId: args.actorUserId,
    communityId: args.communityId,
    previewSnapshot: { actorUsername, communityName },
  })
}

export async function emitModActionOnYou(
  db: Kysely<DB>,
  args: {
    authorUserId: string
    actorUserId: string
    communityId: string
    postId?: string | null
    commentId?: string | null
    title: string | null
    body: string | null
  },
): Promise<void> {
  const communityName = await loadCommunityName(db, args.communityId)
  await crudNotification(db).emit("mod_action_on_you", {
    userId: args.authorUserId,
    actorUserId: args.actorUserId,
    communityId: args.communityId,
    postId: args.postId ?? null,
    commentId: args.commentId ?? null,
    previewSnapshot: {
      communityName,
      title: args.title,
      body: preview(args.body, PREVIEW_LEN),
      postId: args.postId ?? null,
      commentId: args.commentId ?? null,
    },
  })
}

export async function emitContentRemoved(
  db: Kysely<DB>,
  args: {
    targetType: "post" | "comment"
    targetId: string
    actorUserId: string
    communityId: string
    removalReasonId: string | null
  },
): Promise<void> {
  let authorUserId: string | null = null
  let title: string | null = null
  let body: string | null = null
  let postId: string | null = null
  let commentId: string | null = null

  if (args.targetType === "post") {
    const post = await fetchPost(db).getOne(args.targetId, ["authorUserId", "title"])
    authorUserId = post?.authorUserId ?? null
    title = post ? `Your post "${post.title}" was removed` : "Your post was removed"
    postId = args.targetId
  } else {
    const comment = await fetchComment(db).getOne(args.targetId, [
      "authorUserId",
      "postId",
      "bodyMd",
    ])
    authorUserId = comment?.authorUserId ?? null
    title = "Your comment was removed"
    body = preview(comment?.bodyMd, PREVIEW_LEN)
    postId = comment?.postId ?? null
    commentId = args.targetId
  }

  if (!authorUserId) return

  if (args.removalReasonId) {
    const reason = await fetchRemovalReason(db).getOne(args.removalReasonId, ["title", "message"])
    if (reason) {
      title = reason.title
      body = reason.message
    }
  }

  await emitModActionOnYou(db, {
    authorUserId,
    actorUserId: args.actorUserId,
    communityId: args.communityId,
    postId,
    commentId,
    title,
    body,
  })
}

export async function emitUserBanned(
  db: Kysely<DB>,
  args: {
    userId: string
    actorUserId: string
    communityId: string
    messageToUser: string | null
  },
): Promise<void> {
  await emitModActionOnYou(db, {
    authorUserId: args.userId,
    actorUserId: args.actorUserId,
    communityId: args.communityId,
    title: "You were banned",
    body: args.messageToUser,
  })
}

export async function emitChatRequest(
  db: Kysely<DB>,
  args: { recipientUserId: string; actorUserId: string; conversationId: string },
): Promise<void> {
  const actorUsername = await loadActorUsername(db, args.actorUserId)
  await crudNotification(db).emit("chat_request", {
    userId: args.recipientUserId,
    actorUserId: args.actorUserId,
    conversationId: args.conversationId,
    previewSnapshot: { actorUsername },
  })
}

export async function emitJoinRequestApproved(
  db: Kysely<DB>,
  args: { userId: string; actorUserId: string; communityId: string },
): Promise<void> {
  const communityName = await loadCommunityName(db, args.communityId)
  await crudNotification(db).emit("join_request_approved", {
    userId: args.userId,
    actorUserId: args.actorUserId,
    communityId: args.communityId,
    previewSnapshot: { communityName },
  })
}

export async function emitWelcome(
  db: Kysely<DB>,
  args: {
    userId: string
    communityId: string
    communityName: string | null
    welcomeMessage: string
  },
): Promise<void> {
  await crudNotification(db).emit("welcome", {
    userId: args.userId,
    communityId: args.communityId,
    previewSnapshot: {
      communityName: args.communityName,
      body: preview(args.welcomeMessage, PREVIEW_LEN),
    },
  })
}
