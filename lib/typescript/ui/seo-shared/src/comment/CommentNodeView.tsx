"use client"

import type { ReactNode } from "react"
import { Minus, MoreHorizontal, Pencil, Plus, Reply, Share2, Trash2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@ui/base/ui/avatar"
import { Badge } from "@ui/base/ui/badge"
import { Button } from "@ui/base/ui/button"
import { cn } from "@ui/base/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ui/base/ui/dropdown-menu"
import { formatCompactNumber } from "@ui/seo-shared/format-number"
import { Markdown } from "@ui/seo-shared/Markdown"
import { RelativeTime } from "@ui/seo-shared/RelativeTime"
import { SeoLink } from "@ui/seo-shared/_internal/seo-link"
import { VoteCluster } from "@ui/seo-shared/post/VoteCluster"
import { AdminBadge, AuthorInsightsRow } from "@ui/seo-shared/post/PostRow"
import type { CommentNode } from "@ui/seo-shared/comment/types"

export type CommentNodeViewProps = {
  node: CommentNode
  /** Link to the author profile (u/username). */
  authorHref?: string
  collapsed: boolean
  onToggleCollapse: () => void
  /**
   * True when this comment has a loaded, expanded subtree. Only then is the
   * collapse toggle + vertical thread line drawn under the avatar — childless
   * comments show neither (matching Reddit).
   */
  hasThread?: boolean
  /** Highlights this comment's collapse stub when its connector line is hovered. */
  connectorHovered?: boolean
  /** Notifies the tree when the collapse stub is hovered (drives whole-line highlight). */
  onConnectorHoverChange?: (hovering: boolean) => void
  /** Author id of the post this comment belongs to, for the "OP" badge. */
  postAuthorId?: string
  /** Highlights this comment (the target of a single-comment permalink). */
  highlighted?: boolean
  /** Number of descendants hidden while collapsed (shown in the meta line). */
  collapsedCount?: number
  onUpvote?: () => void
  onDownvote?: () => void
  voteDisabled?: boolean
  onReply?: () => void
  onShare?: () => void
  onEdit?: () => void
  onDelete?: () => void
  /** When provided, replaces the body (inline edit composer) and hides the action row. */
  editor?: ReactNode
}

function authorLabel(node: CommentNode): string {
  return node.author ? node.author.username : "[deleted]"
}

function initials(username: string): string {
  return username.slice(0, 2).toUpperCase()
}

/** Small bold-blue "OP" chip shown after the username when the author is the poster. */
function OpBadge() {
  return (
    <span className="text-[11px] font-bold tracking-wide text-blue-500 dark:text-blue-400">OP</span>
  )
}

/** Presentational view of one comment (header, body, action row). No recursion. */
export function CommentNodeView({
  node,
  authorHref,
  collapsed,
  onToggleCollapse,
  hasThread = false,
  connectorHovered = false,
  onConnectorHoverChange,
  postAuthorId,
  highlighted = false,
  collapsedCount,
  onUpvote,
  onDownvote,
  voteDisabled,
  onReply,
  onShare,
  onEdit,
  onDelete,
  editor,
}: CommentNodeViewProps) {
  const isRemoved = node.isDeleted || node.bodyMd === null
  const canEdit = node.isAuthor && !isRemoved && (onEdit ?? onDelete) != null
  const isOp = postAuthorId != null && node.author?.id === postAuthorId

  if (collapsed) {
    return (
      <div className="flex items-center gap-2 py-0.5 text-xs text-muted-foreground">
        <button
          type="button"
          aria-label="Expand comment"
          onClick={onToggleCollapse}
          className="flex size-[18px] shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:border-foreground/50 hover:text-foreground"
        >
          <Plus className="size-3" />
        </button>
        <span className="font-medium text-foreground/80">{authorLabel(node)}</span>
        {isOp ? <OpBadge /> : null}
        {node.author?.isAdmin ? <AdminBadge /> : null}
        <span aria-hidden>·</span>
        <span>{formatCompactNumber(node.score)} points</span>
        <span aria-hidden>·</span>
        <RelativeTime date={node.createdAt} />
        {collapsedCount && collapsedCount > 0 ? (
          <span className="text-muted-foreground/70">
            ({collapsedCount} {collapsedCount === 1 ? "child" : "children"})
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex gap-2",
        highlighted && "-mx-2 rounded-md bg-primary/5 px-2 py-1 ring-1 ring-primary/20",
      )}
    >
      {/* Avatar rail: avatar on top, then the collapse thread-line + toggle. */}
      <div className="flex w-8 shrink-0 flex-col items-center">
        {/* 32px avatar filling the 32px rail so the child elbows land flush against
            it — matching Reddit and leaving no gap between line and avatar. */}
        <Avatar className="size-8">
          {node.author?.avatarImageKey ? (
            <AvatarImage src={node.author.avatarImageKey} alt="" />
          ) : null}
          <AvatarFallback className="text-[11px]">
            {node.author ? initials(node.author.username) : "?"}
          </AvatarFallback>
        </Avatar>
        {hasThread && !editor ? (
          <button
            type="button"
            aria-label="Collapse comment thread"
            onClick={onToggleCollapse}
            onMouseEnter={() => {
              onConnectorHoverChange?.(true)
            }}
            onMouseLeave={() => {
              onConnectorHoverChange?.(false)
            }}
            className="relative flex w-full flex-1 cursor-pointer flex-col items-center justify-end pt-1"
          >
            <span
              className={cn(
                "absolute top-1 bottom-3 left-1/2 w-px -translate-x-1/2 transition-colors",
                connectorHovered ? "bg-foreground/50" : "bg-border",
              )}
            />
            <span
              className={cn(
                "relative z-[1] flex size-[18px] items-center justify-center rounded-full border bg-background transition-colors",
                connectorHovered
                  ? "border-foreground/50 text-foreground"
                  : "border-border text-muted-foreground",
              )}
            >
              <Minus className="size-3" />
            </span>
          </button>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
          {isRemoved ? (
            <span className="font-medium text-foreground/70">{authorLabel(node)}</span>
          ) : authorHref && node.author ? (
            <SeoLink href={authorHref} className="font-medium text-foreground hover:underline">
              {node.author.username}
            </SeoLink>
          ) : (
            <span className="font-medium text-foreground">{authorLabel(node)}</span>
          )}
          {isOp ? <OpBadge /> : null}
          {node.author?.isAdmin ? <AdminBadge /> : null}
          {node.isSticky ? (
            <Badge variant="secondary" className="gap-1 px-1.5 py-0 text-[10px] font-medium">
              Stickied comment
            </Badge>
          ) : null}
          <span aria-hidden>·</span>
          <RelativeTime date={node.createdAt} />
          {node.editedAt ? <span className="italic">(edited)</span> : null}
        </div>

        {editor ??
          (isRemoved ? (
            <p className="text-sm text-muted-foreground italic">[deleted]</p>
          ) : (
            <Markdown content={node.bodyMd} />
          ))}

        {editor ? null : (
          <div className="mt-0.5 flex items-center gap-1">
            <VoteCluster
              score={node.score}
              userVote={node.userVote}
              onUpvote={() => onUpvote?.()}
              onDownvote={() => onDownvote?.()}
              disabled={(voteDisabled ?? false) || isRemoved}
              size="sm"
              variant="plain"
            />
            {onReply && !isRemoved ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 gap-1.5 rounded-full px-2 text-xs font-semibold text-muted-foreground",
                )}
                onClick={onReply}
              >
                <Reply className="size-4" />
                Reply
              </Button>
            ) : null}
            {onShare ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 rounded-full px-2 text-xs font-semibold text-muted-foreground"
                onClick={onShare}
              >
                <Share2 className="size-4" />
                Share
              </Button>
            ) : null}
            {canEdit ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                  aria-label="More actions"
                >
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onEdit ? (
                    <DropdownMenuItem
                      onClick={() => {
                        onEdit()
                      }}
                    >
                      <Pencil className="size-4" />
                      Edit
                    </DropdownMenuItem>
                  ) : null}
                  {onDelete ? (
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => {
                        onDelete()
                      }}
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        )}

        {!editor && node.viewCount != null ? (
          <AuthorInsightsRow viewCount={node.viewCount} />
        ) : null}
      </div>
    </div>
  )
}
