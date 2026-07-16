"use client"

import type { ReactElement, ReactNode } from "react"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@ui/base/ui/hover-card"
import { CommunityIcon } from "@ui/seo-shared/community/CommunityIcon"
import { formatCompactNumber } from "@ui/seo-shared/format-number"
import { visibilityMeta } from "@ui/seo-shared/community/visibility"

export type CommunityHoverCardData = {
  name: string
  displayName: string | null
  description: string
  visibility: string
  iconUrl: string | null
  memberCount: number
  createdAt: string | Date
}

function formatCreated(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function CommunityHoverCardBody({
  data,
  joinSlot,
}: {
  data: CommunityHoverCardData
  joinSlot?: ReactNode
}) {
  const vis = visibilityMeta(data.visibility)
  const VisIcon = vis.icon
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <CommunityIcon name={data.name} iconUrl={data.iconUrl} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">r/{data.name}</p>
          {data.displayName ? (
            <p className="truncate text-xs text-muted-foreground">{data.displayName}</p>
          ) : null}
        </div>
        {joinSlot}
      </div>
      {data.description ? (
        <p className="line-clamp-3 text-sm text-muted-foreground">{data.description}</p>
      ) : null}
      <div className="flex flex-col gap-1 pt-0.5 text-xs text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">
            {formatCompactNumber(data.memberCount)}
          </span>{" "}
          {data.memberCount === 1 ? "member" : "members"}
        </span>
        <span className="inline-flex items-center gap-1">
          <VisIcon className="size-3.5" />
          {vis.label} · Created {formatCreated(data.createdAt)}
        </span>
      </div>
    </div>
  )
}

function CommunityHoverCardSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="size-8 animate-pulse rounded-full bg-muted" />
        <div className="h-4 w-28 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-3 w-full animate-pulse rounded bg-muted" />
      <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
    </div>
  )
}

export type CommunityHoverCardProps = {
  /** The trigger element (typically the r/name link). */
  children: ReactElement
  /** Loaded community data. Omit to show the skeleton while fetching. */
  data?: CommunityHoverCardData
  /** Fires when the popover opens/closes — use to lazily kick off the fetch. */
  onOpenChange?: (open: boolean) => void
  /** Join control rendered in the header (functional in the SPA). */
  joinSlot?: ReactNode
}

/**
 * Reddit-style community preview popover. Presentational: it renders the trigger
 * and the popover body from `data`; the caller wires the lazy fetch via
 * `onOpenChange` and supplies the (functional) Join control through `joinSlot`.
 * Opens on hover after the HoverCard primitive's built-in delay, matching reddit.
 */
export function CommunityHoverCard({
  children,
  data,
  onOpenChange,
  joinSlot,
}: CommunityHoverCardProps) {
  return (
    <HoverCard onOpenChange={onOpenChange}>
      <HoverCardTrigger render={children} />
      <HoverCardContent className="w-80" side="bottom" align="start">
        {data ? (
          <CommunityHoverCardBody data={data} joinSlot={joinSlot} />
        ) : (
          <CommunityHoverCardSkeleton />
        )}
      </HoverCardContent>
    </HoverCard>
  )
}
