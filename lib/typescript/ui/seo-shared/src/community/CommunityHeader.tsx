import type { ReactNode } from "react"
import { CommunityIcon } from "@ui/seo-shared/community/CommunityIcon"
import { formatCompactNumber } from "@ui/seo-shared/format-number"

export type CommunityHeaderCommunity = {
  name: string
  displayName: string | null
  iconUrl: string | null
  bannerUrl: string | null
  memberCount: number
}

export type CommunityHeaderProps = {
  community: CommunityHeaderCommunity
  /** Primary membership action (Join / Joined / Requested / Leave). */
  joinSlot?: ReactNode
  /** Create Post button. */
  createPostSlot?: ReactNode
  /** Notification bell dropdown. */
  bellSlot?: ReactNode
  /** Extra controls (favorite star, mod tools). */
  extraSlot?: ReactNode
}

/**
 * Presentational community banner + identity row. Actions are passed as slots so
 * each frontend supplies its own interactive controls (native links vs. hooks).
 */
export function CommunityHeader({
  community,
  joinSlot,
  createPostSlot,
  bellSlot,
  extraSlot,
}: CommunityHeaderProps) {
  const title = community.displayName ?? community.name

  return (
    <div className="w-full">
      <div className="h-20 w-full overflow-hidden bg-gradient-to-r from-primary/30 to-primary/10 sm:h-28">
        {community.bannerUrl ? (
          // oxlint-disable-next-line no-img-element
          <img src={community.bannerUrl} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>

      <div className="mx-auto w-full max-w-5xl px-4">
        <div className="-mt-6 flex flex-wrap items-end gap-3 sm:-mt-8">
          <CommunityIcon
            name={community.name}
            iconUrl={community.iconUrl}
            size="xl"
            className="border-4 border-background"
          />
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="truncate text-2xl font-bold sm:text-3xl">{title}</h1>
            <p className="truncate text-sm text-muted-foreground">
              r/{community.name} · {formatCompactNumber(community.memberCount)}{" "}
              {community.memberCount === 1 ? "member" : "members"}
            </p>
          </div>
          <div className="flex items-center gap-2 pb-1">
            {createPostSlot}
            {bellSlot}
            {joinSlot}
            {extraSlot}
          </div>
        </div>
      </div>
    </div>
  )
}
