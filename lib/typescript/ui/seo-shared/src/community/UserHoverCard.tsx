"use client"

import type { ReactElement, ReactNode } from "react"
import { CakeIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@ui/base/ui/avatar"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@ui/base/ui/hover-card"
import { formatCompactNumber } from "@ui/seo-shared/format-number"

export type UserHoverCardData = {
  username: string
  displayName: string | null
  avatarUrl: string | null
  postKarma: number
  commentKarma: number
  createdAt: string | Date
}

function formatCakeDay(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function UserHoverCardBody({
  data,
  followSlot,
}: {
  data: UserHoverCardData
  followSlot?: ReactNode
}) {
  const name = data.displayName ?? data.username
  const initial = name.charAt(0).toUpperCase()
  const totalKarma = data.postKarma + data.commentKarma
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Avatar size="lg">
          {data.avatarUrl ? <AvatarImage src={data.avatarUrl} alt={name} /> : null}
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">{name}</p>
          <p className="truncate text-xs text-muted-foreground">u/{data.username}</p>
        </div>
        {followSlot}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="font-semibold text-foreground">{formatCompactNumber(totalKarma)}</div>
          <div className="text-muted-foreground">Karma</div>
        </div>
        <div>
          <div className="inline-flex items-center gap-1 font-semibold text-foreground">
            <CakeIcon className="size-3.5" />
            {formatCakeDay(data.createdAt)}
          </div>
          <div className="text-muted-foreground">Cake day</div>
        </div>
      </div>
    </div>
  )
}

function UserHoverCardSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="size-10 animate-pulse rounded-full bg-muted" />
        <div className="flex flex-col gap-1.5">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-3 w-16 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
    </div>
  )
}

export type UserHoverCardProps = {
  /** The trigger element (typically the u/username link). */
  children: ReactElement
  /** Loaded user data. Omit to show the skeleton while fetching. */
  data?: UserHoverCardData
  /** Fires when the popover opens/closes — use to lazily kick off the fetch. */
  onOpenChange?: (open: boolean) => void
  /** Follow control rendered in the header (functional in the SPA). */
  followSlot?: ReactNode
}

/**
 * Reddit-style user preview popover. Presentational: it renders the trigger and
 * the popover body from `data`; the caller wires the lazy fetch via
 * `onOpenChange` and supplies the (functional) Follow control through
 * `followSlot`. Opens on hover after the HoverCard primitive's built-in delay,
 * matching reddit.
 */
export function UserHoverCard({ children, data, onOpenChange, followSlot }: UserHoverCardProps) {
  return (
    <HoverCard onOpenChange={onOpenChange}>
      <HoverCardTrigger render={children} />
      <HoverCardContent className="w-72" side="bottom" align="start">
        {data ? (
          <UserHoverCardBody data={data} followSlot={followSlot} />
        ) : (
          <UserHoverCardSkeleton />
        )}
      </HoverCardContent>
    </HoverCard>
  )
}
