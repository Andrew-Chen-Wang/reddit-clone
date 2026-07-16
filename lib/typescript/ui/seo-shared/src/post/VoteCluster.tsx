"use client"

import { ArrowBigDown, ArrowBigUp } from "lucide-react"
import { cn } from "@ui/base/lib/utils"
import { formatCompactNumber } from "@ui/seo-shared/format-number"

export type VoteValue = -1 | 0 | 1

export type VoteClusterProps = {
  score: number
  userVote: number
  onUpvote: () => void
  onDownvote: () => void
  disabled?: boolean
  orientation?: "vertical" | "horizontal"
  size?: "sm" | "md"
  /**
   * `pill` (default): rounded background capsule used in feeds/post headers.
   * `plain`: no capsule background — bare inline arrows + count, used inline in
   * the comment action row (Reddit comment style). Hover tint is per-button.
   */
  variant?: "pill" | "plain"
}

/**
 * Reddit-style vote cluster: up arrow, score, down arrow. The active direction is
 * tinted (upvote orange, downvote violet). Purely presentational — the caller owns
 * vote state and supplies `onUpvote` / `onDownvote` (which should toggle when the
 * user re-clicks the active direction). Shared between SSR and SPA.
 */
export function VoteCluster({
  score,
  userVote,
  onUpvote,
  onDownvote,
  disabled = false,
  orientation = "horizontal",
  size = "md",
  variant = "pill",
}: VoteClusterProps) {
  const upActive = userVote > 0
  const downActive = userVote < 0
  const active = upActive || downActive
  const iconSize = size === "sm" ? "size-4" : "size-5"
  const scoreText = size === "sm" ? "text-xs" : "text-sm"
  const plain = variant === "plain"
  // Reddit's pill fills with orangered / periwinkle and turns its contents white
  // when voted. The plain (comment) variant has no capsule, so it only tints text.
  const pillFilled = !plain && active

  return (
    <div
      className={cn(
        "inline-flex items-center",
        orientation === "vertical" ? "flex-col" : "flex-row",
        plain
          ? "gap-0.5"
          : cn("rounded-full bg-muted", upActive && "bg-[#d93a00]", downActive && "bg-[#6a5cff]"),
      )}
      data-orientation={orientation}
    >
      <button
        type="button"
        aria-label="Upvote"
        aria-pressed={upActive}
        disabled={disabled}
        onClick={onUpvote}
        className={cn(
          "flex items-center justify-center rounded-full p-1 transition-colors disabled:pointer-events-none",
          plain && "hover:bg-orange-500/10",
          pillFilled
            ? "text-white"
            : cn("hover:text-orange-500", upActive ? "text-orange-500" : "text-muted-foreground"),
        )}
      >
        <ArrowBigUp className={cn(iconSize, upActive && "fill-current")} />
      </button>
      <span
        className={cn(
          "select-none text-center font-semibold tabular-nums",
          plain ? "min-w-4 px-0.5" : "min-w-8",
          scoreText,
          pillFilled
            ? "text-white"
            : cn(
                upActive && "text-orange-500",
                downActive && "text-violet-500",
                !active && "text-foreground",
              ),
        )}
      >
        {score === 0 ? "Vote" : formatCompactNumber(score)}
      </span>
      <button
        type="button"
        aria-label="Downvote"
        aria-pressed={downActive}
        disabled={disabled}
        onClick={onDownvote}
        className={cn(
          "flex items-center justify-center rounded-full p-1 transition-colors disabled:pointer-events-none",
          plain && "hover:bg-violet-500/10",
          pillFilled
            ? "text-white"
            : cn("hover:text-violet-500", downActive ? "text-violet-500" : "text-muted-foreground"),
        )}
      >
        <ArrowBigDown className={cn(iconSize, downActive && "fill-current")} />
      </button>
    </div>
  )
}
