import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { Button } from "@ui/base/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ui/base/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@ui/base/ui/popover"
import { CommunityIcon } from "@ui/seo-shared/community/CommunityIcon"
import { PostFeed, type FeedPost } from "@frontends/dashboard/components/PostFeed"
import { mediaUrl } from "@frontends/dashboard/lib/mediaUrl"
import {
  deleteApiV1CustomFeedByIdCommunityByCommunityIdMutation,
  getApiV1CommunityMemberMineOptions,
  getApiV1CustomFeedByUsernameBySlugOptions,
  putApiV1CustomFeedByIdCommunityByCommunityIdMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { Plus, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

export const Route = createFileRoute("/feed/$username/$slug")({
  component: CustomFeedPage,
})

const FEED_SORTS = [
  { value: "hot", label: "Hot" },
  { value: "new", label: "New" },
  { value: "top", label: "Top" },
  { value: "rising", label: "Rising" },
  { value: "controversial", label: "Controversial" },
]

type JoinedCommunity = {
  id: string
  name: string
  displayName: string | null
  iconImageKey: string | null
}

function AddCommunitiesCombobox({
  feedId,
  existingIds,
  onChanged,
}: {
  feedId: string
  existingIds: Set<string>
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const { data: mine } = useQuery(getApiV1CommunityMemberMineOptions())
  const add = useMutation({
    ...putApiV1CustomFeedByIdCommunityByCommunityIdMutation(),
    onSuccess: onChanged,
    onError: () => {
      toast.error("Could not add community")
    },
  })

  const candidates = ((mine?.data ?? []) as JoinedCommunity[]).filter(
    (community) => !existingIds.has(community.id),
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            <Plus className="size-4" />
            Add communities
          </Button>
        }
      />
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search communities..." />
          <CommandList>
            <CommandEmpty>No communities to add.</CommandEmpty>
            <CommandGroup>
              {candidates.map((community) => (
                <CommandItem
                  key={community.id}
                  value={community.name}
                  onSelect={() => {
                    add.mutate({ path: { id: feedId, communityId: community.id } })
                  }}
                >
                  <CommunityIcon
                    name={community.name}
                    iconUrl={mediaUrl(community.iconImageKey)}
                    size="sm"
                  />
                  <span className="truncate">r/{community.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function CustomFeedPage() {
  const { username, slug } = Route.useParams()
  const queryClient = useQueryClient()
  const options = getApiV1CustomFeedByUsernameBySlugOptions({ path: { username, slug } })
  const feedQuery = useQuery(options)
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: options.queryKey })
  }

  const removeCommunity = useMutation({
    ...deleteApiV1CustomFeedByIdCommunityByCommunityIdMutation(),
    onSuccess: invalidate,
    onError: () => {
      toast.error("Could not remove community")
    },
  })

  if (feedQuery.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  const feed = feedQuery.data
  if (feedQuery.isError || !feed) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-5xl flex-col items-center justify-center gap-2 px-4 text-center">
        <h1 className="text-xl font-semibold">Feed not found</h1>
        <p className="text-sm text-muted-foreground">
          This custom feed is private or doesn&apos;t exist.
        </p>
      </div>
    )
  }

  const existingIds = new Set(feed.communities.map((community) => community.id))

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-4 flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-bold">{feed.name}</h1>
          <p className="text-sm text-muted-foreground">
            Custom feed by{" "}
            <Link
              to="/user/$username"
              params={{ username: feed.owner.username }}
              className="hover:underline"
            >
              u/{feed.owner.username}
            </Link>
          </p>
          {feed.description ? (
            <p className="mt-1 text-sm text-muted-foreground">{feed.description}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {feed.communities.map((community) => (
            <span
              key={community.id}
              className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 py-1 pl-1.5 pr-2 text-sm"
            >
              <CommunityIcon
                name={community.name}
                iconUrl={mediaUrl(community.iconImageKey)}
                size="sm"
              />
              <Link to="/r/$name" params={{ name: community.name }} className="hover:underline">
                r/{community.name}
              </Link>
              {feed.isOwner ? (
                <button
                  type="button"
                  aria-label={`Remove r/${community.name}`}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                  onClick={() => {
                    removeCommunity.mutate({ path: { id: feed.id, communityId: community.id } })
                  }}
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </span>
          ))}
          {feed.isOwner ? (
            <AddCommunitiesCombobox
              feedId={feed.id}
              existingIds={existingIds}
              onChanged={invalidate}
            />
          ) : null}
        </div>
      </div>

      {feed.communities.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            This feed has no communities yet
          </p>
          {feed.isOwner ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Add communities above to start building your feed.
            </p>
          ) : null}
        </div>
      ) : (
        <PostFeed
          source={{ kind: "customFeed", username, slug }}
          sorts={FEED_SORTS}
          defaultSort="hot"
          showJoin
          permalinkFor={(post: FeedPost) =>
            post.community
              ? `/r/${post.community.name}/comments/${post.id}`
              : `/comments/${post.id}`
          }
          emptyTitle="No posts yet"
          emptyDescription="The communities in this feed haven't posted anything recently."
        />
      )}
    </div>
  )
}
