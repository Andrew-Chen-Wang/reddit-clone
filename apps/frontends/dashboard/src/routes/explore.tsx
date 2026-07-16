import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Button } from "@ui/base/ui/button"
import { cn } from "@ui/base/lib/utils"
import { CommunityCard } from "@ui/seo-shared/community/CommunityCard"
import { mediaUrl } from "@frontends/dashboard/lib/mediaUrl"
import {
  getApiV1ExploreOptions,
  postApiV1CommunityMemberByCommunityIdJoinMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { useState } from "react"
import { toast } from "sonner"

export const Route = createFileRoute("/explore")({
  component: ExplorePage,
})

type ExploreCommunity = {
  id: string
  name: string
  displayName: string | null
  description: string
  iconImageKey: string | null
  memberCount: number
  isNsfw: boolean
}

type ExploreSectionData = {
  topicId: string
  topicName: string
  topicSlug: string
  communities: ExploreCommunity[]
  hasMore: boolean
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

  if (state === "joined") {
    return (
      <Button size="sm" variant="outline" disabled>
        Joined
      </Button>
    )
  }
  if (state === "requested") {
    return (
      <Button size="sm" variant="outline" disabled>
        Requested
      </Button>
    )
  }
  return (
    <Button
      size="sm"
      disabled={join.isPending}
      onClick={() => {
        join.mutate({ path: { communityId } })
      }}
    >
      Join
    </Button>
  )
}

function ExploreSection({ section }: { section: ExploreSectionData }) {
  const queryClient = useQueryClient()
  const [communities, setCommunities] = useState(section.communities)
  const [hasMore, setHasMore] = useState(section.hasMore)
  const [loading, setLoading] = useState(false)

  async function showMore() {
    setLoading(true)
    try {
      const res = await queryClient.fetchQuery(
        getApiV1ExploreOptions({ query: { topic: section.topicSlug, offset: communities.length } }),
      )
      const next = res.sections[0]
      const more = (next?.communities ?? []) as ExploreCommunity[]
      setCommunities((prev) => [...prev, ...more])
      setHasMore(next?.hasMore ?? false)
    } catch {
      toast.error("Could not load more communities")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section id={`topic-${section.topicSlug}`}>
      <h2 className="mb-3 text-lg font-semibold">{section.topicName}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {communities.map((community) => (
          <CommunityCard
            key={community.id}
            community={{
              name: community.name,
              displayName: community.displayName,
              description: community.description,
              iconUrl: mediaUrl(community.iconImageKey),
              memberCount: community.memberCount,
            }}
            joinSlot={<JoinButton communityId={community.id} />}
          />
        ))}
      </div>
      {hasMore ? (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            onClick={() => {
              void showMore()
            }}
            disabled={loading}
          >
            {loading ? "Loading…" : "Show more"}
          </Button>
        </div>
      ) : null}
    </section>
  )
}

function CommunityGrid({ communities }: { communities: ExploreCommunity[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {communities.map((community) => (
        <CommunityCard
          key={community.id}
          community={{
            name: community.name,
            displayName: community.displayName,
            description: community.description,
            iconUrl: mediaUrl(community.iconImageKey),
            memberCount: community.memberCount,
          }}
          joinSlot={<JoinButton communityId={community.id} />}
        />
      ))}
    </div>
  )
}

function ExplorePage() {
  const { data, isLoading } = useQuery(getApiV1ExploreOptions())
  const [activeTopic, setActiveTopic] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  const topics = data?.topics ?? []
  const sections = (data?.sections ?? []) as ExploreSectionData[]
  const shown = activeTopic ? sections.filter((s) => s.topicSlug === activeTopic) : sections
  const recommended = (data?.recommended ?? []) as ExploreCommunity[]
  const moreLike = (data?.moreLike ?? []) as { basedOn: string; communities: ExploreCommunity[] }[]
  const showRecommendations = !activeTopic && (recommended.length > 0 || moreLike.length > 0)

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold">Explore</h1>

      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => {
            setActiveTopic(null)
          }}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors",
            !activeTopic ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
          )}
        >
          All
        </button>
        {topics.map((topic) => (
          <button
            key={topic.id}
            type="button"
            onClick={() => {
              setActiveTopic(topic.slug)
            }}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors",
              activeTopic === topic.slug
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:bg-accent",
            )}
          >
            {topic.name}
          </button>
        ))}
      </div>

      {showRecommendations ? (
        <div className="mt-6 flex flex-col gap-8">
          {recommended.length > 0 ? (
            <section>
              <h2 className="mb-3 text-lg font-semibold">Recommended for you</h2>
              <CommunityGrid communities={recommended} />
            </section>
          ) : null}
          {moreLike.map((group) => (
            <section key={group.basedOn}>
              <h2 className="mb-3 text-lg font-semibold">More like r/{group.basedOn}</h2>
              <CommunityGrid communities={group.communities} />
            </section>
          ))}
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-8">
        {shown.map((section) => (
          <ExploreSection key={section.topicId} section={section} />
        ))}
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">No communities to explore yet.</p>
        ) : null}
      </div>
    </div>
  )
}
