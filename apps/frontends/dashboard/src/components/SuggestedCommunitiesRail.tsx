import { useMutation, useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Button } from "@ui/base/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@ui/base/ui/card"
import { CommunityIcon } from "@ui/seo-shared/community/CommunityIcon"
import { formatCompactNumber } from "@ui/seo-shared/format-number"
import { mediaUrl } from "@frontends/dashboard/lib/mediaUrl"
import {
  getApiV1ExploreOptions,
  postApiV1CommunityMemberByCommunityIdJoinMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { useState } from "react"
import { toast } from "sonner"

type Suggested = {
  id: string
  name: string
  displayName: string | null
  iconImageKey: string | null
  memberCount: number
}

function JoinButton({ communityId }: { communityId: string }) {
  const [state, setState] = useState<"idle" | "joined" | "requested">("idle")
  const join = useMutation({
    ...postApiV1CommunityMemberByCommunityIdJoinMutation(),
    onSuccess: (result) => {
      setState(result.requested ? "requested" : "joined")
    },
    onError: () => toast.error("Could not join community"),
  })
  if (state !== "idle") {
    return (
      <Button size="sm" variant="outline" disabled>
        {state === "joined" ? "Joined" : "Requested"}
      </Button>
    )
  }
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={join.isPending}
      onClick={() => {
        join.mutate({ path: { communityId } })
      }}
    >
      Join
    </Button>
  )
}

/** "Recommended communities" card for the home right rail, backed by Explore recommendations. */
export function SuggestedCommunitiesRail() {
  const { data } = useQuery(getApiV1ExploreOptions())
  const recommended = ((data?.recommended ?? []) as Suggested[]).slice(0, 5)
  if (recommended.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Recommended communities
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {recommended.map((community) => (
          <div key={community.id} className="flex items-center gap-2">
            <CommunityIcon
              name={community.name}
              iconUrl={mediaUrl(community.iconImageKey)}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <Link
                to="/r/$name"
                params={{ name: community.name }}
                className="block truncate text-sm font-medium hover:underline"
              >
                r/{community.name}
              </Link>
              <p className="truncate text-xs text-muted-foreground">
                {formatCompactNumber(community.memberCount)}{" "}
                {community.memberCount === 1 ? "member" : "members"}
              </p>
            </div>
            <JoinButton communityId={community.id} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
