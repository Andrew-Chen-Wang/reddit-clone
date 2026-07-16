import {
  ArrowBigUp,
  AtSign,
  Bell,
  Mail,
  MessageSquare,
  PartyPopper,
  Shield,
  UserPlus,
  type LucideIcon,
} from "lucide-react"
import type { QueryClient } from "@tanstack/react-query"
import type { GetApiV1NotificationResponse } from "@lib/api-client/generated/types.gen"

export type NotificationItem = GetApiV1NotificationResponse["data"][number]

/**
 * Invalidate every notification list query (bell preview + full-page infinite)
 * plus the unread-count badge after a read/archive mutation.
 */
export function invalidateNotifications(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({
    predicate: (query) => {
      const id = (query.queryKey[0] as { _id?: string } | undefined)?._id
      return id === "getApiV1Notification" || id === "getApiV1NotificationUnreadCount"
    },
  })
}

/** Notification types whose target is a post/comment permalink. */
const POST_TYPES = new Set([
  "comment_reply",
  "post_reply",
  "mention",
  "upvote_post",
  "upvote_comment",
  "mod_action_on_you",
])

const ICONS: Record<string, LucideIcon> = {
  comment_reply: MessageSquare,
  post_reply: MessageSquare,
  mention: AtSign,
  upvote_post: ArrowBigUp,
  upvote_comment: ArrowBigUp,
  new_follower: UserPlus,
  mod_invite: Shield,
  mod_action_on_you: Shield,
  chat_request: Mail,
  join_request_approved: PartyPopper,
  welcome: PartyPopper,
}

export function iconFor(type: string): LucideIcon {
  return ICONS[type] ?? Bell
}

/** Human-friendly headline for a notification row. */
export function describeNotification(n: NotificationItem): string {
  const s = n.previewSnapshot
  const actor = s?.actorUsername ? `u/${s.actorUsername}` : "Someone"
  const community = s?.communityName ? `r/${s.communityName}` : null
  const count = s?.count ?? null

  switch (n.type) {
    case "comment_reply":
      return `${actor} replied to your comment`
    case "post_reply":
      return `${actor} replied to your post`
    case "mention":
      return `${actor} mentioned you`
    case "upvote_post":
      return count ? `Your post reached ${count} upvotes` : "Your post is getting upvotes"
    case "upvote_comment":
      return count ? `Your comment reached ${count} upvotes` : "Your comment is getting upvotes"
    case "new_follower":
      return `${actor} followed you`
    case "mod_invite":
      return community ? `You're invited to moderate ${community}` : "You have a new mod invitation"
    case "mod_action_on_you":
      return community
        ? `A moderator action in ${community} affected you`
        : "A moderator action affected you"
    case "chat_request":
      return `${actor} wants to chat with you`
    case "join_request_approved":
      return community
        ? `Your request to join ${community} was approved`
        : "Your join request was approved"
    case "welcome":
      return "Welcome to ReadIt"
    default:
      return n.type.replaceAll("_", " ")
  }
}

/**
 * Where clicking a notification should take the user. Prefers the snapshot's
 * community name + post/comment ids so we can build a permalink; falls back to
 * the notifications page for types without a clear in-app target.
 */
export function destinationFor(n: NotificationItem): string {
  const s = n.previewSnapshot

  if (POST_TYPES.has(n.type)) {
    const community = s?.communityName
    const postId = s?.postId ?? n.postId
    const commentId = s?.commentId ?? n.commentId
    if (community && postId) {
      return commentId
        ? `/r/${community}/comments/${postId}?comment=${commentId}`
        : `/r/${community}/comments/${postId}`
    }
    return "/notifications"
  }

  switch (n.type) {
    case "new_follower":
      return s?.actorUsername ? `/user/${s.actorUsername}` : "/notifications"
    case "chat_request":
      return "/chat?filter=requests"
    case "join_request_approved":
      return s?.communityName ? `/r/${s.communityName}` : "/notifications"
    case "welcome":
      return s?.communityName ? `/r/${s.communityName}` : "/"
    // mod_invite has no dedicated route (invites live in the AppSidebar banner).
    default:
      return "/notifications"
  }
}

/** Preview title/body snippet shown under the headline, if any. */
export function snippetFor(n: NotificationItem): string | null {
  const s = n.previewSnapshot
  const title = s?.title?.trim()
  if (title) return title
  const body = s?.body?.trim()
  if (body) return body
  return null
}

/**
 * The 11 preference types with friendly labels + descriptions, in display
 * order. Mirrors the backend's notification type set.
 */
export const PREFERENCE_TYPES: { type: string; label: string; description: string }[] = [
  {
    type: "comment_reply",
    label: "Comment replies",
    description: "When someone replies to one of your comments.",
  },
  {
    type: "post_reply",
    label: "Post replies",
    description: "When someone comments on one of your posts.",
  },
  {
    type: "mention",
    label: "Mentions",
    description: "When someone mentions your username.",
  },
  {
    type: "upvote_post",
    label: "Post upvotes",
    description: "Upvote milestones on your posts.",
  },
  {
    type: "upvote_comment",
    label: "Comment upvotes",
    description: "Upvote milestones on your comments.",
  },
  {
    type: "new_follower",
    label: "New followers",
    description: "When someone follows you.",
  },
  {
    type: "mod_invite",
    label: "Mod invitations",
    description: "When you're invited to moderate a community.",
  },
  {
    type: "mod_action_on_you",
    label: "Moderator actions",
    description: "When a moderator action affects you or your content.",
  },
  {
    type: "chat_request",
    label: "Chat requests",
    description: "When someone requests to chat with you.",
  },
  {
    type: "join_request_approved",
    label: "Join requests approved",
    description: "When your request to join a community is approved.",
  },
  {
    type: "welcome",
    label: "Welcome & onboarding",
    description: "Occasional onboarding messages from ReadIt.",
  },
]
