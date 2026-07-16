import type { ReactNode } from "react"
import { Card, CardContent } from "@ui/base/ui/card"
import { CommunityIcon } from "@ui/seo-shared/community/CommunityIcon"
import { SeoLink } from "@ui/seo-shared/_internal/seo-link"
import { formatCompactNumber } from "@ui/seo-shared/format-number"

export type CommunityCardCommunity = {
  name: string
  displayName: string | null
  description: string
  iconUrl: string | null
  memberCount: number
}

export type CommunityCardProps = {
  community: CommunityCardCommunity
  /** Join button (functional in SPA, login link on the anon site). */
  joinSlot?: ReactNode
}

/** Presentational community card used in the Explore grid. */
export function CommunityCard({ community, joinSlot }: CommunityCardProps) {
  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-2 pt-6">
        <div className="flex items-center gap-2">
          <CommunityIcon name={community.name} iconUrl={community.iconUrl} size="md" />
          <div className="min-w-0 flex-1">
            <SeoLink
              href={`/r/${community.name}`}
              className="block truncate font-semibold hover:underline"
            >
              r/{community.name}
            </SeoLink>
            <p className="truncate text-xs text-muted-foreground">
              {formatCompactNumber(community.memberCount)}{" "}
              {community.memberCount === 1 ? "member" : "members"}
            </p>
          </div>
          {joinSlot}
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">{community.description}</p>
      </CardContent>
    </Card>
  )
}
