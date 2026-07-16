"use client"

import { useState } from "react"
import { Lock } from "lucide-react"
import { Button } from "@ui/base/ui/button"
import { LoginPromptDialog } from "@ui/seo-shared/LoginPromptDialog"
import {
  assembleCommentTree,
  assembleFocusedThread,
  type CommentNode,
} from "@ui/seo-shared/comment/types"
import { CommentSorter } from "@ui/seo-shared/comment/CommentSorter"
import { CommentTree, type CommentTreeCallbacks } from "@ui/seo-shared/comment/CommentTree"
import type { CommentSortValue } from "@ui/seo-shared/comment/types"
import { SeoLink } from "@website/components/seo-link"

export type AnonCommentSectionProps = {
  postId: string
  communityName: string
  sort: CommentSortValue
  nodes: CommentNode[]
  ancestors: CommentNode[]
  focusCommentId?: string
  commentCount: number
  hasMoreRoots: boolean
  nextOffset: number
  locked: boolean
  /** Author id of the post, for the "OP" badge on the poster's own comments. */
  postAuthorId?: string
}

/**
 * Read-only comment tree for the anonymous (SSR) post page. The tree, collapse,
 * and threading lines are interactive client-side, but any action that needs an
 * account (vote, reply, comment) opens the login prompt. Sort and "load more"
 * are plain query-param links so each variant re-renders on the server and stays
 * crawlable.
 */
export function AnonCommentSection({
  postId,
  communityName,
  sort,
  nodes,
  ancestors,
  focusCommentId,
  commentCount,
  hasMoreRoots,
  nextOffset,
  locked,
  postAuthorId,
}: AnonCommentSectionProps) {
  const [loginOpen, setLoginOpen] = useState(false)
  const tree = focusCommentId ? assembleFocusedThread(ancestors, nodes) : assembleCommentTree(nodes)
  const basePath = `/r/${communityName}/comments/${postId}`

  function permalink(commentId: string): string {
    return `${basePath}?comment=${commentId}&sort=${sort}`
  }

  const callbacks: CommentTreeCallbacks = {
    buildAuthorHref: (username) => `/user/${username}`,
    buildPermalinkHref: (commentId) => permalink(commentId),
    onVote: () => {
      setLoginOpen(true)
    },
    onReply: () => {
      setLoginOpen(true)
    },
    onShare: (node) => {
      void navigator.clipboard.writeText(`${window.location.origin}${permalink(node.id)}`)
    },
    buildLoadRepliesHref: (node) => permalink(node.id),
  }

  return (
    <section className="mt-4 flex flex-col gap-4 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          {commentCount} {commentCount === 1 ? "Comment" : "Comments"}
        </h2>
        <CommentSorter
          sort={sort}
          buildHref={(next) =>
            focusCommentId
              ? `${basePath}?comment=${focusCommentId}&sort=${next}`
              : `${basePath}?sort=${next}`
          }
        />
      </div>

      {locked ? (
        <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
          <Lock className="size-4" />
          Comments are locked.
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setLoginOpen(true)
          }}
          className="w-full rounded-md border px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted"
        >
          Log in to join the conversation
        </button>
      )}

      {focusCommentId ? (
        <div className="flex flex-col gap-1 rounded-md border bg-muted/30 px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">
            You are viewing a single comment&apos;s thread.
          </span>
          <SeoLink
            href={`${basePath}?sort=${sort}`}
            className="w-fit text-xs font-semibold text-primary hover:underline"
          >
            ← View all comments
          </SeoLink>
        </div>
      ) : null}

      {tree.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <CommentTree
          nodes={tree}
          callbacks={callbacks}
          postAuthorId={postAuthorId}
          highlightCommentId={focusCommentId}
        />
      )}

      {!focusCommentId && hasMoreRoots ? (
        <div className="flex justify-center">
          <SeoLink href={`${basePath}?sort=${sort}&offset=${nextOffset}`}>
            <Button type="button" variant="outline" size="sm">
              View more comments
            </Button>
          </SeoLink>
        </div>
      ) : null}

      <LoginPromptDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </section>
  )
}
