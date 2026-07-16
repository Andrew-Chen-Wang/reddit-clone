"use client"

import type { ReactNode } from "react"
import { Minus, MoreHorizontal, Pencil, Plus, Reply, Share2, Trash2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@ui/base/ui/avatar"
import { Badge } from "@ui/base/ui/badge"
import { Button } from "@ui/base/ui/button"
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
import type { CommentNode } from "@ui/seo-shared/comment/types"

export type CommentNodeViewProps = {
  node: CommentNode
  /** Link to the author profile (u/username). */
  authorHref?: string
  collapsed: boolean
  onToggleCollapse: () => void
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

/** Presentational view of one comment (header, body, action row). No recursion. */
export function CommentNodeView({
  node,
  authorHref,
  collapsed,
  onToggleCollapse,
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

  if (collapsed) {
    return (
      <div className="flex items-center gap-1.5 py-1 text-xs text-muted-foreground">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Expand comment"
          className="size-5 shrink-0"
          onClick={onToggleCollapse}
        >
          <Plus className="size-3.5" />
        </Button>
        <span className="font-medium text-foreground/80">{authorLabel(node)}</span>
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
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Collapse comment"
          className="size-5 shrink-0"
          onClick={onToggleCollapse}
        >
          <Minus className="size-3.5" />
        </Button>
        <Avatar size="sm" className="size-5">
          {node.author?.avatarImageKey ? (
            <AvatarImage src={node.author.avatarImageKey} alt="" />
          ) : null}
          <AvatarFallback className="text-[9px]">
            {node.author ? initials(node.author.username) : "?"}
          </AvatarFallback>
        </Avatar>
        {isRemoved ? (
          <span className="font-medium text-foreground/70">{authorLabel(node)}</span>
        ) : authorHref && node.author ? (
          <SeoLink href={authorHref} className="font-medium text-foreground hover:underline">
            {node.author.username}
          </SeoLink>
        ) : (
          <span className="font-medium text-foreground">{authorLabel(node)}</span>
        )}
        {node.isSticky ? (
          <Badge variant="secondary" className="gap-1 px-1.5 py-0 text-[10px] font-medium">
            Stickied comment
          </Badge>
        ) : null}
        <span aria-hidden>·</span>
        <RelativeTime date={node.createdAt} />
        {node.editedAt ? <span className="italic">(edited)</span> : null}
      </div>

      <div className="pl-6">
        {editor ??
          (isRemoved ? (
            <p className="text-sm text-muted-foreground italic">[deleted]</p>
          ) : (
            <Markdown content={node.bodyMd} />
          ))}

        {editor ? null : (
          <div className="mt-1 flex items-center gap-0.5">
            <VoteCluster
              score={node.score}
              userVote={node.userVote}
              onUpvote={() => onUpvote?.()}
              onDownvote={() => onDownvote?.()}
              disabled={(voteDisabled ?? false) || isRemoved}
              size="sm"
            />
            {onReply && !isRemoved ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 rounded-full text-xs font-semibold text-muted-foreground"
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
                className="h-7 gap-1.5 rounded-full text-xs font-semibold text-muted-foreground"
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
      </div>
    </div>
  )
}
