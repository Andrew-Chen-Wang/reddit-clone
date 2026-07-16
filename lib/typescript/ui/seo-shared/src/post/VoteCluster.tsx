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
}: VoteClusterProps) {
  const upActive = userVote > 0
  const downActive = userVote < 0
  const iconSize = size === "sm" ? "size-4" : "size-5"
  const scoreText = size === "sm" ? "text-xs" : "text-sm"

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full bg-muted",
        orientation === "vertical" ? "flex-col" : "flex-row",
        upActive && "bg-orange-500/15",
        downActive && "bg-violet-500/15",
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
          "flex items-center justify-center rounded-full p-1 transition-colors hover:text-orange-500 disabled:pointer-events-none",
          upActive ? "text-orange-500" : "text-muted-foreground",
        )}
      >
        <ArrowBigUp className={cn(iconSize, upActive && "fill-current")} />
      </button>
      <span
        className={cn(
          "min-w-8 select-none text-center font-semibold tabular-nums",
          scoreText,
          upActive && "text-orange-500",
          downActive && "text-violet-500",
          !upActive && !downActive && "text-foreground",
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
          "flex items-center justify-center rounded-full p-1 transition-colors hover:text-violet-500 disabled:pointer-events-none",
          downActive ? "text-violet-500" : "text-muted-foreground",
        )}
      >
        <ArrowBigDown className={cn(iconSize, downActive && "fill-current")} />
      </button>
    </div>
  )
}
