import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Avatar, AvatarFallback, AvatarImage } from "@ui/base/ui/avatar"
import { Button } from "@ui/base/ui/button"
import { cn } from "@ui/base/lib/utils"
import { CommunityCard } from "@ui/seo-shared/community/CommunityCard"
import { markdownToText } from "@ui/seo-shared/markdown-to-text"
import { PostRow, type PostRowPost } from "@ui/seo-shared/post/PostRow"
import { RelativeTime } from "@ui/seo-shared/RelativeTime"
import { SeoLink } from "@frontends/dashboard/components/seo-link"
import { mediaUrl } from "@frontends/dashboard/lib/mediaUrl"
import { getApiV1Search } from "@lib/api-client/generated/sdk.gen"
import {
  getApiV1CommunityByNameOptions,
  postApiV1CommunityMemberByCommunityIdJoinMutation,
  putApiV1PostVoteByPostIdMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { Search as SearchIcon, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

type SearchType = "posts" | "comments" | "communities" | "media" | "profiles"
type SearchSort = "relevance" | "hot" | "top" | "new" | "comments"
type TopWindow = "hour" | "day" | "week" | "month" | "year" | "all"

type SearchParams = {
  q: string
  type: SearchType
  sort: SearchSort
  t: TopWindow
  community?: string
  author?: string
}

const TYPES: { value: SearchType; label: string }[] = [
  { value: "posts", label: "Posts" },
  { value: "comments", label: "Comments" },
  { value: "communities", label: "Communities" },
  { value: "media", label: "Media" },
  { value: "profiles", label: "Profiles" },
]

const SORTS: { value: SearchSort; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "hot", label: "Hot" },
  { value: "top", label: "Top" },
  { value: "new", label: "New" },
  { value: "comments", label: "Comments" },
]

const TOP_WINDOWS: { value: TopWindow; label: string }[] = [
  { value: "hour", label: "Now" },
  { value: "day", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
  { value: "all", label: "All Time" },
]

const TYPE_VALUES = TYPES.map((tp) => tp.value)
const SORT_VALUES = SORTS.map((s) => s.value)
const WINDOW_VALUES = TOP_WINDOWS.map((w) => w.value)

function oneOf<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === "string" && (allowed as string[]).includes(value)
    ? (value as T)
    : fallback
}

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    q: typeof search.q === "string" ? search.q : "",
    type: oneOf(search.type, TYPE_VALUES, "posts"),
    sort: oneOf(search.sort, SORT_VALUES, "relevance"),
    t: oneOf(search.t, WINDOW_VALUES, "all"),
    community: typeof search.community === "string" ? search.community : undefined,
    author: typeof search.author === "string" ? search.author : undefined,
  }),
  component: SearchPage,
})

type SearchResponse = Awaited<ReturnType<typeof getApiV1Search>>["data"]
type SearchPage = NonNullable<SearchResponse>
type PostResult = SearchPage["posts"][number]
type CommentResult = SearchPage["comments"][number]
type ProfileResult = SearchPage["profiles"][number]

function chipClass(active: boolean): string {
  return cn(
    "shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors",
    active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
  )
}

function nextVoteValue(current: number, direction: 1 | -1): 1 | 0 | -1 {
  if (direction === 1) return current === 1 ? 0 : 1
  return current === -1 ? 0 : -1
}

function applyVoteToCache(
  data: InfiniteData<SearchPage> | undefined,
  postId: string,
  newVote: 1 | 0 | -1,
): InfiniteData<SearchPage> | undefined {
  if (!data) return data
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      posts: page.posts.map((p) => {
        if (p.id !== postId) return p
        return { ...p, userVote: newVote, score: p.score + (newVote - p.userVote) }
      }),
    })),
  }
}

function toRowPost(post: PostResult): PostRowPost {
  return {
    ...post,
    community: post.community
      ? { ...post.community, iconImageKey: mediaUrl(post.community.iconImageKey) }
      : null,
  }
}

function permalinkForPost(post: PostResult): string {
  if (post.community) return `/r/${post.community.name}/comments/${post.id}`
  if (post.author) return `/u/${post.author.username}`
  return "/"
}

function CommentResultCard({ result }: { result: CommentResult }) {
  const { comment } = result
  const href = `/r/${result.communityName ?? "readit"}/comments/${comment.postId}?comment=${comment.id}`
  return (
    <article className="rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {comment.author ? <span>u/{comment.author.username}</span> : <span>[deleted]</span>}
        <span aria-hidden>·</span>
        <RelativeTime date={comment.createdAt} />
        <span aria-hidden>·</span>
        <span>{comment.score} points</span>
      </div>
      <p className="mt-1.5 line-clamp-3 text-sm">{markdownToText(comment.bodyMd, 320)}</p>
      <SeoLink
        href={href}
        className="mt-2 inline-block text-xs font-medium text-muted-foreground hover:underline"
      >
        on “{result.postTitle}”{result.communityName ? ` in r/${result.communityName}` : null}
      </SeoLink>
    </article>
  )
}

function ProfileResultCard({ profile }: { profile: ProfileResult }) {
  const initial = (profile.displayName ?? profile.username).charAt(0).toUpperCase()
  return (
    <SeoLink
      href={`/u/${profile.username}`}
      className="flex items-center gap-3 rounded-lg border bg-card p-3 hover:border-muted-foreground/30"
    >
      <Avatar className="size-10">
        {profile.avatarImageKey ? (
          <AvatarImage src={mediaUrl(profile.avatarImageKey) ?? undefined} alt="" />
        ) : null}
        <AvatarFallback>{initial}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">u/{profile.username}</p>
        <p className="truncate text-xs text-muted-foreground">
          {profile.karma} karma
          {profile.about ? ` · ${markdownToText(profile.about, 80)}` : null}
        </p>
      </div>
    </SeoLink>
  )
}

function CommunityJoinButton({ communityId }: { communityId: string }) {
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

function SearchPage() {
  const params = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(params.q)

  const showSort = params.type === "posts" || params.type === "comments" || params.type === "media"
  const showWindow = showSort && params.sort === "top"

  const communityQuery = useQuery({
    ...getApiV1CommunityByNameOptions({ path: { name: params.community ?? "" } }),
    enabled: !!params.community,
  })
  const communityId = communityQuery.data?.id ?? null
  const communityResolved = !params.community || communityId != null

  const queryKey = [
    "search",
    params.q,
    params.type,
    params.sort,
    params.t,
    communityId,
    params.author ?? null,
  ]

  const search = useInfiniteQuery({
    queryKey,
    enabled: params.q.trim().length > 0 && communityResolved,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data } = await getApiV1Search({
        query: {
          q: params.q,
          type: params.type,
          sort: params.sort,
          t: params.t,
          communityId: communityId ?? undefined,
          authorUsername: params.author,
          cursor: pageParam,
        },
        throwOnError: true,
      })
      return data
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })

  const voteMutation = useMutation({
    ...putApiV1PostVoteByPostIdMutation(),
    onError: () => {
      void queryClient.invalidateQueries({ queryKey })
      toast.error("Could not register your vote")
    },
  })

  function vote(post: PostResult, direction: 1 | -1) {
    const newVote = nextVoteValue(post.userVote, direction)
    queryClient.setQueryData<InfiniteData<SearchPage>>(queryKey, (old) =>
      applyVoteToCache(old, post.id, newVote),
    )
    voteMutation.mutate({ path: { postId: post.id }, body: { value: newVote } })
  }

  function update(patch: Partial<SearchParams>) {
    void navigate({ search: (prev) => ({ ...prev, ...patch }) })
  }

  const pages = search.data?.pages ?? []
  const total = pages[0]?.total ?? 0
  const posts = pages.flatMap((p) => p.posts)
  const comments = pages.flatMap((p) => p.comments)
  const communities = pages.flatMap((p) => p.communities)
  const profiles = pages.flatMap((p) => p.profiles)

  const hasQuery = params.q.trim().length > 0
  const isGrid = params.type === "communities"
  const scopeLabel = params.community
    ? `r/${params.community}`
    : params.author
      ? `u/${params.author}`
      : null

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          update({ q: draft.trim() })
        }}
        className="relative mb-3 flex items-center gap-2 rounded-md border bg-background pl-3 focus-within:ring-1 focus-within:ring-ring"
      >
        <SearchIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
        {scopeLabel ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
            {scopeLabel}
            <button
              type="button"
              aria-label="Remove scope"
              className="rounded-full hover:bg-background"
              onClick={() => {
                update({ community: undefined, author: undefined })
              }}
            >
              <X className="size-3" />
            </button>
          </span>
        ) : null}
        <input
          type="search"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
          }}
          placeholder={scopeLabel ? `Search in ${scopeLabel}` : "Search ReadIt"}
          aria-label="Search"
          className="min-w-0 flex-1 bg-transparent py-2 pr-3 text-sm outline-none"
        />
      </form>

      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {TYPES.map((tp) => (
          <button
            key={tp.value}
            type="button"
            onClick={() => {
              update({ type: tp.value })
            }}
            className={chipClass(params.type === tp.value)}
          >
            {tp.label}
          </button>
        ))}
      </div>

      {showSort ? (
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {SORTS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => {
                update({ sort: s.value })
              }}
              className={chipClass(params.sort === s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      ) : null}

      {showWindow ? (
        <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
          {TOP_WINDOWS.map((w) => (
            <button
              key={w.value}
              type="button"
              onClick={() => {
                update({ t: w.value })
              }}
              className={cn(chipClass(params.t === w.value), "text-xs")}
            >
              {w.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-5">
        {!hasQuery ? (
          <p className="text-sm text-muted-foreground">Enter a search term to get started.</p>
        ) : search.isLoading ? (
          <p className="text-sm text-muted-foreground">Searching…</p>
        ) : total === 0 ? (
          <p className="text-sm text-muted-foreground">
            No {params.type} found for “{params.q}”.
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-muted-foreground">
              {total} {total === 1 ? "result" : "results"}
            </p>
            <div className={cn(isGrid ? "grid gap-3 sm:grid-cols-2" : "flex flex-col gap-3")}>
              {(params.type === "posts" || params.type === "media") &&
                posts.map((post) => (
                  <PostRow
                    key={post.id}
                    post={toRowPost(post)}
                    href={permalinkForPost(post)}
                    communityHref={post.community ? `/r/${post.community.name}` : undefined}
                    authorHref={post.author ? `/u/${post.author.username}` : undefined}
                    onUpvote={() => {
                      vote(post, 1)
                    }}
                    onDownvote={() => {
                      vote(post, -1)
                    }}
                  />
                ))}
              {params.type === "comments" &&
                comments.map((result) => (
                  <CommentResultCard key={result.comment.id} result={result} />
                ))}
              {params.type === "communities" &&
                communities.map((community) => (
                  <CommunityCard
                    key={community.id}
                    community={{
                      name: community.name,
                      displayName: community.displayName,
                      description: community.description,
                      iconUrl: mediaUrl(community.iconImageKey),
                      memberCount: community.memberCount,
                    }}
                    joinSlot={<CommunityJoinButton communityId={community.id} />}
                  />
                ))}
              {params.type === "profiles" &&
                profiles.map((profile) => <ProfileResultCard key={profile.id} profile={profile} />)}
            </div>
            {search.hasNextPage ? (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  disabled={search.isFetchingNextPage}
                  onClick={() => {
                    void search.fetchNextPage()
                  }}
                >
                  {search.isFetchingNextPage ? "Loading…" : "Show more"}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
