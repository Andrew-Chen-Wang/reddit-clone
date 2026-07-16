"use client"

import { PostRow, type PostRowPost } from "@ui/seo-shared/post/PostRow"
import { LoginPromptDialog } from "@ui/seo-shared/LoginPromptDialog"
import {
  ProfileCommentCard,
  type ProfileCommentCardComment,
} from "@ui/seo-shared/profile/ProfileCommentCard"
import { useState } from "react"

export type AnonOverviewItem =
  | { kind: "post"; post: PostRowPost }
  | { kind: "comment"; comment: ProfileCommentCardComment }

function permalinkFor(post: PostRowPost): string {
  if (post.community) return `/r/${post.community.name}/comments/${post.id}`
  if (post.author) return `/user/${post.author.username}`
  return "/"
}

/**
 * Anonymous (SEO) profile Overview: the user's posts and comments intertwined
 * newest-first, server-rendered for crawlers. Voting opens a login prompt. The
 * mixed list is a single server-rendered page — continuation needs the
 * authenticated overview API.
 */
export function AnonProfileOverview({ items }: { items: AnonOverviewItem[] }) {
  const [loginOpen, setLoginOpen] = useState(false)

  function openLogin() {
    setLoginOpen(true)
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) =>
        item.kind === "post" ? (
          <PostRow
            key={`post-${item.post.id}`}
            post={item.post}
            variant="card"
            href={permalinkFor(item.post)}
            communityHref={item.post.community ? `/r/${item.post.community.name}` : undefined}
            authorHref={item.post.author ? `/user/${item.post.author.username}` : undefined}
            showCommunity
            onUpvote={openLogin}
            onDownvote={openLogin}
          />
        ) : (
          <ProfileCommentCard key={`comment-${item.comment.id}`} comment={item.comment} />
        ),
      )}
      <LoginPromptDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </div>
  )
}
