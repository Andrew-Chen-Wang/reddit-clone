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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@ui/base/ui/dropdown-menu"
import { PostRow, type PostRowPost } from "@ui/seo-shared/post/PostRow"
import { PostFeedSkeleton } from "@ui/seo-shared/post/PostRowSkeleton"
import { PostActionsMenu } from "@frontends/dashboard/components/PostActionsMenu"
import { PostShareMenu } from "@frontends/dashboard/components/PostShareMenu"
import {
  CommunityLinkHoverCard,
  UserLinkHoverCard,
} from "@frontends/dashboard/components/PostHoverCards"
import { mediaUrl } from "@frontends/dashboard/lib/mediaUrl"
import {
  getApiV1CustomFeedByUsernameBySlugPosts,
  getApiV1FeedCommunityByName,
  getApiV1FeedHome,
  getApiV1FeedMod,
  getApiV1FeedPopular,
  getApiV1FeedProfileByUsername,
  putApiV1PostVoteByPostId,
} from "@lib/api-client/generated/sdk.gen"
import {
  getApiV1CommunityMemberMineOptions,
  getApiV1UserMeSettingsOptions,
  patchApiV1UserMeSettingsMutation,
  postApiV1CommunityMemberByCommunityIdJoinMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { ArrowUpDown, LayoutList, Rows3, Check } from "lucide-react"
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from "react"
import { toast } from "sonner"

// Community icon keys arrive as raw storage keys; resolve them to public URLs
// for display. Idempotent, so post media (already absolute) is untouched.
function toDisplayPost(post: FeedPost): FeedPost {
  return post.community
    ? {
        ...post,
        community: { ...post.community, iconImageKey: mediaUrl(post.community.iconImageKey) },
      }
    : post
}

function wrapCommunityLink(link: ReactElement, name: string): ReactNode {
  return <CommunityLinkHoverCard name={name}>{link}</CommunityLinkHoverCard>
}

function wrapAuthorLink(link: ReactElement, username: string): ReactNode {
  return <UserLinkHoverCard username={username}>{link}</UserLinkHoverCard>
}

function FeedJoinButton({ communityId }: { communityId: string }) {
  const queryClient = useQueryClient()
  const [joined, setJoined] = useState(false)
  const join = useMutation({
    ...postApiV1CommunityMemberByCommunityIdJoinMutation(),
    onSuccess: () => {
      setJoined(true)
      void queryClient.invalidateQueries({
        queryKey: getApiV1CommunityMemberMineOptions().queryKey,
      })
    },
    onError: () => {
      toast.error("Could not join community")
    },
  })
  if (joined) {
    return (
      <Button size="sm" variant="outline" className="h-7 rounded-full px-3" disabled>
        Joined
      </Button>
    )
  }
  return (
    <Button
      size="sm"
      className="h-7 rounded-full px-3"
      disabled={join.isPending}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        join.mutate({ path: { communityId } })
      }}
    >
      Join
    </Button>
  )
}

export type FeedPost = PostRowPost & {
  isAuthor: boolean
  community: {
    id: string
    name: string
    displayName: string | null
    iconImageKey: string | null
    isMember?: boolean
  } | null
  author: { username: string; displayName: string | null; isAdmin?: boolean } | null
  flair: { id: string; text: string; bgColor: string | null; textColor: string | null } | null
}
export type FeedPage = { data: FeedPost[]; nextCursor: string | null }

export type TopWindow = "hour" | "day" | "week" | "month" | "year" | "all"

export type FeedSortDef = { value: string; label: string }

/** Which backend feed this component pulls from. */
export type FeedSource =
  | { kind: "community"; name: string; flairTemplateId?: string }
  | { kind: "popular" }
  | { kind: "home" }
  | { kind: "profile"; username: string }
  | { kind: "customFeed"; username: string; slug: string }
  | { kind: "mod" }

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
      query: { ...query, flairTemplateId: source.flairTemplateId } as never,
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
  if (source.kind === "customFeed") {
    const { data } = await getApiV1CustomFeedByUsernameBySlugPosts({
      path: { username: source.username, slug: source.slug },
      query: query as never,
      throwOnError: true,
    })
    return data
  }
  if (source.kind === "home") {
    const { data } = await getApiV1FeedHome({ query: query as never, throwOnError: true })
    return data
  }
  if (source.kind === "mod") {
    const { data } = await getApiV1FeedMod({ query: query as never, throwOnError: true })
    return data
  }
  const { data } = await getApiV1FeedPopular({ query: query as never, throwOnError: true })
  return data
}

function feedQueryKey(source: FeedSource, sort: string, t: TopWindow): unknown[] {
  const base =
    source.kind === "community"
      ? ["feed", "community", source.name, source.flairTemplateId ?? null]
      : source.kind === "profile"
        ? ["feed", "profile", source.username]
        : source.kind === "customFeed"
          ? ["feed", "customFeed", source.username, source.slug]
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

/** Removes a post from every page of the cached feed (used for hide/delete). */
function removePostFromCache(
  data: InfiniteData<FeedPage> | undefined,
  postId: string,
): InfiniteData<FeedPage> | undefined {
  if (!data) return data
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      data: page.data.filter((p) => p.id !== postId),
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
  showJoin?: boolean
  emptyTitle?: string
  emptyDescription?: string
}

export function PostFeed({
  source,
  sorts,
  defaultSort,
  permalinkFor,
  showCommunity = true,
  showJoin = false,
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

  function removeFromFeed(postId: string) {
    queryClient.setQueryData<InfiniteData<FeedPage>>(queryKey, (old) =>
      removePostFromCache(old, postId),
    )
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

        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
              aria-label="Change view"
            >
              {view === "compact" ? (
                <Rows3 className="size-4" />
              ) : (
                <LayoutList className="size-4" />
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>View</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => {
                    setViewMode("card")
                  }}
                >
                  <LayoutList className="size-4" />
                  Card
                  {view === "card" ? <Check className="ml-auto size-4" /> : null}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setViewMode("compact")
                  }}
                >
                  <Rows3 className="size-4" />
                  Compact
                  {view === "compact" ? <Check className="ml-auto size-4" /> : null}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
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
        <div className={view === "compact" ? "overflow-hidden rounded-lg border" : "flex flex-col"}>
          {posts.map((post) => (
            <PostRow
              key={post.id}
              post={toDisplayPost(post)}
              variant={view}
              href={permalinkFor(post)}
              communityHref={post.community ? `/r/${post.community.name}` : undefined}
              authorHref={post.author ? `/user/${post.author.username}` : undefined}
              showCommunity={showCommunity}
              wrapCommunityLink={wrapCommunityLink}
              wrapAuthorLink={wrapAuthorLink}
              onUpvote={() => {
                vote(post, 1)
              }}
              onDownvote={() => {
                vote(post, -1)
              }}
              voteDisabled={post.isLocked}
              joinSlot={
                showJoin && post.community && post.community.isMember === false ? (
                  <FeedJoinButton communityId={post.community.id} />
                ) : undefined
              }
              shareSlot={
                <PostShareMenu
                  post={{
                    id: post.id,
                    title: post.title,
                    community: post.community ? { name: post.community.name } : null,
                  }}
                  permalink={permalinkFor(post)}
                />
              }
              menuSlot={
                <PostActionsMenu
                  post={{
                    id: post.id,
                    type: post.type,
                    bodyMd: post.bodyMd,
                    isNsfw: post.isNsfw,
                    isSpoiler: post.isSpoiler,
                    isOc: post.isOc,
                    isAuthor: post.isAuthor,
                    author: post.author ? { username: post.author.username } : null,
                    community: post.community
                      ? { id: post.community.id, name: post.community.name }
                      : null,
                    flair: post.flair ? { id: post.flair.id } : null,
                  }}
                  onHidden={removeFromFeed}
                  onDeleted={removeFromFeed}
                  onEdited={() => {
                    void feed.refetch()
                  }}
                />
              }
            />
          ))}
        </div>
      )}

      {feed.isFetchingNextPage ? <PostFeedSkeleton count={2} variant={view} /> : null}
      <div ref={sentinelRef} aria-hidden className="h-px" />
    </div>
  )
}
