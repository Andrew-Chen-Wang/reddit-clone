"use client"

import { Fragment, type ReactNode, useState } from "react"
import { ArrowRight, MessageSquare } from "lucide-react"
import { cn } from "@ui/base/lib/utils"
import { Button } from "@ui/base/ui/button"
import { Spinner } from "@ui/base/ui/spinner"
import { SeoLink } from "@ui/seo-shared/_internal/seo-link"
import { CommentNodeView } from "@ui/seo-shared/comment/CommentNodeView"
import {
  type CommentNode,
  type CommentTreeNode,
  unloadedReplyCount,
} from "@ui/seo-shared/comment/types"

/** Reddit renders 10 nested levels per page, then links to a permalink page. */
export const MAX_VISUAL_DEPTH = 10

export type CommentTreeCallbacks = {
  buildAuthorHref?: (username: string) => string
  /** Permalink for a comment: used by share + the "Continue this thread" link. */
  buildPermalinkHref: (commentId: string) => string
  /** Toggle a vote. Value is the desired next state (0 clears). */
  onVote?: (node: CommentNode, value: -1 | 0 | 1) => void
  voteDisabled?: boolean
  onReply?: (node: CommentNode) => void
  onShare?: (node: CommentNode) => void
  onEdit?: (node: CommentNode) => void
  onDelete?: (node: CommentNode) => void
  /** SPA: fetch the next page of a node's direct replies. */
  onLoadReplies?: (node: CommentNode) => void
  loadingReplies?: ReadonlySet<string>
  /** SSR/anon: render "N more replies" as a crawlable link instead of a button. */
  buildLoadRepliesHref?: (node: CommentNode) => string
  /** Host-controlled inline reply composer (open under this node id). */
  replyingId?: string | null
  renderReplyComposer?: (node: CommentNode) => ReactNode
  /** Host-controlled inline edit composer (replaces this node's body). */
  editingId?: string | null
  renderEditComposer?: (node: CommentNode) => ReactNode
}

export type CommentTreeProps = {
  nodes: CommentTreeNode[]
  callbacks: CommentTreeCallbacks
  className?: string
}

function countLoadedDescendants(node: CommentTreeNode): number {
  let total = 0
  for (const child of node.children) total += 1 + countLoadedDescendants(child)
  return total
}

function nextVote(current: number, direction: 1 | -1): -1 | 0 | 1 {
  if (direction === 1) return current === 1 ? 0 : 1
  return current === -1 ? 0 : -1
}

/**
 * Recursive comment tree. Draws the Reddit-style threading lines (one vertical
 * line per nesting level; hovering or clicking it collapses the subtree), the
 * collapse/expand toggle, per-node "N more replies", and the "Continue this
 * thread" link once a branch exceeds {@link MAX_VISUAL_DEPTH} levels. All
 * interactions are delegated to `callbacks`.
 */
export function CommentTree({ nodes, callbacks, className }: CommentTreeProps) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function renderNode(node: CommentTreeNode, visualDepth: number): ReactNode {
    const isCollapsed = collapsed.has(node.id)
    const atMaxDepth = visualDepth >= MAX_VISUAL_DEPTH
    const remaining = unloadedReplyCount(node)
    const isReplying = callbacks.replyingId === node.id && callbacks.renderReplyComposer != null
    const isEditing = callbacks.editingId === node.id && callbacks.renderEditComposer != null
    const showChildrenArea = !isCollapsed && !atMaxDepth && node.children.length > 0
    const isLoadingReplies = callbacks.loadingReplies?.has(node.id) ?? false

    return (
      <div className="flex flex-col">
        <CommentNodeView
          node={node}
          authorHref={
            node.author && callbacks.buildAuthorHref
              ? callbacks.buildAuthorHref(node.author.username)
              : undefined
          }
          collapsed={isCollapsed}
          onToggleCollapse={() => {
            toggleCollapse(node.id)
          }}
          collapsedCount={countLoadedDescendants(node)}
          voteDisabled={callbacks.voteDisabled}
          onUpvote={
            callbacks.onVote
              ? () => callbacks.onVote?.(node, nextVote(node.userVote, 1))
              : undefined
          }
          onDownvote={
            callbacks.onVote
              ? () => callbacks.onVote?.(node, nextVote(node.userVote, -1))
              : undefined
          }
          onReply={callbacks.onReply ? () => callbacks.onReply?.(node) : undefined}
          onShare={callbacks.onShare ? () => callbacks.onShare?.(node) : undefined}
          onEdit={callbacks.onEdit ? () => callbacks.onEdit?.(node) : undefined}
          onDelete={callbacks.onDelete ? () => callbacks.onDelete?.(node) : undefined}
          editor={isEditing ? callbacks.renderEditComposer?.(node) : undefined}
        />

        {!isCollapsed && isReplying ? (
          <div className="mt-2 pl-6">{callbacks.renderReplyComposer?.(node)}</div>
        ) : null}

        {!isCollapsed && atMaxDepth && node.childCount > 0 ? (
          <div className="mt-1 pl-6">
            <SeoLink
              href={callbacks.buildPermalinkHref(node.id)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              Continue this thread
              <ArrowRight className="size-3.5" />
            </SeoLink>
          </div>
        ) : null}

        {showChildrenArea ? (
          <div className="relative mt-1 pl-5">
            <button
              type="button"
              aria-label="Collapse thread"
              onClick={() => {
                toggleCollapse(node.id)
              }}
              className="group/line absolute top-0 bottom-0 left-1.5 flex w-4 cursor-pointer justify-center"
            >
              <span className="w-0.5 rounded-full bg-border transition-colors group-hover/line:bg-foreground/40" />
            </button>
            <div className="flex flex-col gap-3">
              {node.children.map((child) => (
                <Fragment key={child.id}>{renderNode(child, visualDepth + 1)}</Fragment>
              ))}
              {remaining > 0 ? (
                <MoreReplies
                  node={node}
                  remaining={remaining}
                  loading={isLoadingReplies}
                  callbacks={callbacks}
                />
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Leaf node (or budget-truncated) with unloaded replies but no rendered children yet. */}
        {!isCollapsed && !atMaxDepth && node.children.length === 0 && remaining > 0 ? (
          <div className="mt-1 pl-6">
            <MoreReplies
              node={node}
              remaining={remaining}
              loading={isLoadingReplies}
              callbacks={callbacks}
            />
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {nodes.map((node) => (
        <Fragment key={node.id}>{renderNode(node, 0)}</Fragment>
      ))}
    </div>
  )
}

function MoreReplies({
  node,
  remaining,
  loading,
  callbacks,
}: {
  node: CommentTreeNode
  remaining: number
  loading: boolean
  callbacks: CommentTreeCallbacks
}) {
  const label = `${remaining} more ${remaining === 1 ? "reply" : "replies"}`

  if (callbacks.buildLoadRepliesHref) {
    return (
      <SeoLink
        href={callbacks.buildLoadRepliesHref(node)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
      >
        <MessageSquare className="size-3.5" />
        {label}
      </SeoLink>
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={loading}
      className="h-7 w-fit gap-1.5 rounded-full px-2 text-xs font-semibold text-primary"
      onClick={() => {
        callbacks.onLoadReplies?.(node)
      }}
    >
      {loading ? <Spinner className="size-3.5" /> : <MessageSquare className="size-3.5" />}
      {label}
    </Button>
  )
}
