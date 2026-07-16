import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query"
import { Button, buttonVariants } from "@ui/base/ui/button"
import { cn } from "@ui/base/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ui/base/ui/dropdown-menu"
import { PostRow, type PostRowPost } from "@ui/seo-shared/post/PostRow"
import { PostFeedSkeleton } from "@ui/seo-shared/post/PostRowSkeleton"
import {
  getApiV1FeedCommunityByName,
  getApiV1FeedHome,
  getApiV1FeedPopular,
  getApiV1FeedProfileByUsername,
  putApiV1PostVoteByPostId,
} from "@lib/api-client/generated/sdk.gen"
import {
  getApiV1UserMeSettingsOptions,
  patchApiV1UserMeSettingsMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { ArrowUpDown, LayoutList, Rows3, Check } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

export type FeedPost = PostRowPost & {
  community: { name: string; displayName: string | null; iconImageKey: string | null } | null
  author: { username: string; displayName: string | null } | null
}
export type FeedPage = { data: FeedPost[]; nextCursor: string | null }

export type TopWindow = "hour" | "day" | "week" | "month" | "year" | "all"

export type FeedSortDef = { value: string; label: string }

/** Which backend feed this component pulls from. */
export type FeedSource =
  | { kind: "community"; name: string }
  | { kind: "popular" }
  | { kind: "home" }
  | { kind: "profile"; username: string }

type ViewMode = "card" | "compact"

const TOP_WINDOWS: { value: TopWindow; label: string }[] = [
  { value: "hour", label: "Now" },
  { value: "day", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
  { value: "all", label: "All Time" },
]

async function fetchFeedPage(
  source: FeedSource,
  sort: string,
  t: TopWindow,
  cursor: string | undefined,
): Promise<FeedPage> {
  const query = { sort, t, cursor } as { sort: string; t: TopWindow; cursor?: string }
  if (source.kind === "community") {
    const { data } = await getApiV1FeedCommunityByName({
      path: { name: source.name },
      query: query as never,
      throwOnError: true,
    })
    return data
  }
  if (source.kind === "profile") {
    const { data } = await getApiV1FeedProfileByUsername({
      path: { username: source.username },
      query: query as never,
      throwOnError: true,
    })
    return data
  }
  if (source.kind === "home") {
    const { data } = await getApiV1FeedHome({ query: query as never, throwOnError: true })
    return data
  }
  const { data } = await getApiV1FeedPopular({ query: query as never, throwOnError: true })
  return data
}

function feedQueryKey(source: FeedSource, sort: string, t: TopWindow): unknown[] {
  const base =
    source.kind === "community"
      ? ["feed", "community", source.name]
      : source.kind === "profile"
        ? ["feed", "profile", source.username]
        : ["feed", source.kind]
  return [...base, sort, t]
}

function nextVoteValue(current: number, direction: 1 | -1): 1 | 0 | -1 {
  if (direction === 1) return current === 1 ? 0 : 1
  return current === -1 ? 0 : -1
}

/** Optimistically applies a vote to every page of the cached feed. */
function applyVoteToCache(
  data: InfiniteData<FeedPage> | undefined,
  postId: string,
  newVote: 1 | 0 | -1,
): InfiniteData<FeedPage> | undefined {
  if (!data) return data
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      data: page.data.map((p) => {
        if (p.id !== postId) return p
        const delta = newVote - p.userVote
        return { ...p, userVote: newVote, score: p.score + delta }
      }),
    })),
  }
}

export type PostFeedProps = {
  source: FeedSource
  sorts: FeedSortDef[]
  defaultSort: string
  /** Build the permalink for a post's title/comments link. */
  permalinkFor: (post: FeedPost) => string
  /** Show the community identity line on each row. Defaults to true. */
  showCommunity?: boolean
  emptyTitle?: string
  emptyDescription?: string
}

export function PostFeed({
  source,
  sorts,
  defaultSort,
  permalinkFor,
  showCommunity = true,
  emptyTitle = "No posts yet",
  emptyDescription = "There's nothing here yet. Check back later.",
}: PostFeedProps) {
  const queryClient = useQueryClient()
  const [sort, setSort] = useState(defaultSort)
  const [topWindow, setTopWindow] = useState<TopWindow>("day")

  const { data: settings } = useQuery(getApiV1UserMeSettingsOptions())
  const [viewOverride, setViewOverride] = useState<ViewMode | null>(null)
  const view: ViewMode = viewOverride ?? (settings?.feedView as ViewMode | undefined) ?? "card"

  const patchSettings = useMutation({
    ...patchApiV1UserMeSettingsMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: getApiV1UserMeSettingsOptions().queryKey })
    },
  })

  const t: TopWindow = sort === "top" ? topWindow : "all"
  const queryKey = feedQueryKey(source, sort, t)

  const feed = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchFeedPage(source, sort, t, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })

  const voteMutation = useMutation({
    mutationFn: (vars: { postId: string; value: 1 | 0 | -1 }) =>
      putApiV1PostVoteByPostId({
        path: { postId: vars.postId },
        body: { value: vars.value },
        throwOnError: true,
      }),
    onError: () => {
      void queryClient.invalidateQueries({ queryKey })
      toast.error("Could not register your vote")
    },
  })

  function vote(post: FeedPost, direction: 1 | -1) {
    const newVote = nextVoteValue(post.userVote, direction)
    queryClient.setQueryData<InfiniteData<FeedPage>>(queryKey, (old) =>
      applyVoteToCache(old, post.id, newVote),
    )
    voteMutation.mutate({ postId: post.id, value: newVote })
  }

  function setViewMode(next: ViewMode) {
    setViewOverride(next)
    patchSettings.mutate({ body: { feedView: next } })
  }

  // Infinite scroll sentinel.
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && feed.hasNextPage && !feed.isFetchingNextPage) {
          void feed.fetchNextPage()
        }
      },
      { rootMargin: "600px" },
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
    }
  }, [feed.hasNextPage, feed.isFetchingNextPage, feed])

  const posts = feed.data?.pages.flatMap((p) => p.data) ?? []
  const activeSort = sorts.find((s) => s.value === sort) ?? sorts[0]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}
          >
            <ArrowUpDown className="size-4" />
            {activeSort?.label}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {sorts.map((s) => (
              <DropdownMenuItem
                key={s.value}
                onClick={() => {
                  setSort(s.value)
                }}
              >
                {s.value === sort ? <Check className="size-4" /> : <span className="size-4" />}
                {s.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {sort === "top" ? (
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              {TOP_WINDOWS.find((w) => w.value === topWindow)?.label}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {TOP_WINDOWS.map((w) => (
                <DropdownMenuItem
                  key={w.value}
                  onClick={() => {
                    setTopWindow(w.value)
                  }}
                >
                  {w.value === topWindow ? (
                    <Check className="size-4" />
                  ) : (
                    <span className="size-4" />
                  )}
                  {w.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant={view === "card" ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label="Card view"
            onClick={() => {
              setViewMode("card")
            }}
          >
            <LayoutList className="size-4" />
          </Button>
          <Button
            variant={view === "compact" ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label="Compact view"
            onClick={() => {
              setViewMode("compact")
            }}
          >
            <Rows3 className="size-4" />
          </Button>
        </div>
      </div>

      {feed.isLoading ? (
        <PostFeedSkeleton variant={view} />
      ) : feed.isError ? (
        <div className="rounded-lg border bg-card p-10 text-center">
          <p className="text-sm font-medium text-muted-foreground">Could not load posts</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              void feed.refetch()
            }}
          >
            Try again
          </Button>
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center">
          <p className="text-sm font-medium text-muted-foreground">{emptyTitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">{emptyDescription}</p>
        </div>
      ) : (
        <div
          className={
            view === "compact" ? "overflow-hidden rounded-lg border" : "flex flex-col gap-3"
          }
        >
          {posts.map((post) => (
            <PostRow
              key={post.id}
              post={post}
              variant={view}
              href={permalinkFor(post)}
              communityHref={post.community ? `/r/${post.community.name}` : undefined}
              authorHref={post.author ? `/u/${post.author.username}` : undefined}
              showCommunity={showCommunity}
              onUpvote={() => {
                vote(post, 1)
              }}
              onDownvote={() => {
                vote(post, -1)
              }}
              voteDisabled={post.isLocked}
              onShare={() => {
                const url = `${window.location.origin}${permalinkFor(post)}`
                void navigator.clipboard.writeText(url)
                toast.success("Link copied")
              }}
            />
          ))}
        </div>
      )}

      {feed.isFetchingNextPage ? <PostFeedSkeleton count={2} variant={view} /> : null}
      <div ref={sentinelRef} aria-hidden className="h-px" />
    </div>
  )
}
