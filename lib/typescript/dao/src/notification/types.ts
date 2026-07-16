export const NOTIFICATION_TYPES = [
  "comment_reply",
  "post_reply",
  "post_reply_follow",
  "comment_reply_follow",
  "mention",
  "upvote_post",
  "upvote_comment",
  "new_follower",
  "mod_invite",
  "mod_action_on_you",
  "chat_request",
  "join_request_approved",
  "welcome",
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const NOTIFICATION_LEVELS = ["off", "inbox", "all"] as const

export type NotificationLevel = (typeof NOTIFICATION_LEVELS)[number]

export const DEFAULT_NOTIFICATION_LEVEL: NotificationLevel = "inbox"

export interface PreviewSnapshot {
  title?: string | null
  body?: string | null
  communityName?: string | null
  actorUsername?: string | null
  postId?: string | null
  commentId?: string | null
  url?: string | null
  count?: number | null
}

export function isUpvoteMilestone(count: number): boolean {
  if (count < 1) return false
  let m = 1
  while (m < count) m *= 10
  return m === count
}
