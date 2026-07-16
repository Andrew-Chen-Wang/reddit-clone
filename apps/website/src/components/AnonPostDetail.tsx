"use client"

import { PostDetailCard } from "@ui/seo-shared/post/PostDetailCard"
import type { PostRowPost } from "@ui/seo-shared/post/PostRow"
import { LoginPromptDialog } from "@ui/seo-shared/LoginPromptDialog"
import { useState } from "react"

export type AnonPostDetailProps = {
  post: PostRowPost
  communityHref?: string
  authorHref?: string
}

/** Anonymous post detail: voting opens a login prompt, share copies the link. */
export function AnonPostDetail({ post, communityHref, authorHref }: AnonPostDetailProps) {
  const [loginOpen, setLoginOpen] = useState(false)

  return (
    <>
      <PostDetailCard
        post={post}
        communityHref={communityHref}
        authorHref={authorHref}
        onBack={() => {
          window.history.back()
        }}
        voteDisabled={post.isLocked}
        onUpvote={() => {
          setLoginOpen(true)
        }}
        onDownvote={() => {
          setLoginOpen(true)
        }}
        onShare={() => {
          void navigator.clipboard.writeText(window.location.href)
        }}
      />
      <LoginPromptDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  )
}
