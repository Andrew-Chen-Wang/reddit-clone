import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { Button } from "@ui/base/ui/button"
import { cn } from "@ui/base/lib/utils"
import { PostRow } from "@ui/seo-shared/post/PostRow"
import {
  applyVoteToCache,
  chipClass,
  CommentResultCard,
  nextVoteValue,
  permalinkForPost,
  type PostResult,
  type SearchPageData,
  toRowPost,
} from "@frontends/dashboard/components/searchResults"
import { getApiV1Search } from "@lib/api-client/generated/sdk.gen"
import {
  getApiV1CommunityByNameOptions,
  putApiV1PostVoteByPostIdMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { Search as SearchIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

type SearchType = "posts" | "comments" | "media"
type SearchSort = "relevance" | "hot" | "top" | "new" | "comments"
type TopWindow = "hour" | "day" | "week" | "month" | "year" | "all"

type CommunitySearchParams = {
  q: string
  type: SearchType
  sort: SearchSort
  t: TopWindow
}

const TYPES: { value: SearchType; label: string }[] = [
  { value: "posts", label: "Posts" },
  { value: "comments", label: "Comments" },
  { value: "media", label: "Media" },
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

export const Route = createFileRoute("/r_/$name/search")({
  validateSearch: (search: Record<string, unknown>): CommunitySearchParams => ({
    q: typeof search.q === "string" ? search.q : "",
    type: oneOf(search.type, TYPE_VALUES, "posts"),
    sort: oneOf(search.sort, SORT_VALUES, "relevance"),
    t: oneOf(search.t, WINDOW_VALUES, "all"),
  }),
  component: CommunitySearchPage,
})

function CommunitySearchPage() {
  const { name } = Route.useParams()
  const params = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(params.q)
  useEffect(() => {
    setDraft(params.q)
  }, [params.q])

  const showWindow = params.sort === "top"

  const communityQuery = useQuery(getApiV1CommunityByNameOptions({ path: { name } }))
  const communityId = communityQuery.data?.id ?? null

  const queryKey = ["community-search", name, params.q, params.type, params.sort, params.t]

  const search = useInfiniteQuery({
    queryKey,
    enabled: params.q.trim().length > 0 && communityId != null,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data } = await getApiV1Search({
        query: {
          q: params.q,
          type: params.type,
          sort: params.sort,
          t: params.t,
          communityId: communityId ?? undefined,
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
    queryClient.setQueryData<InfiniteData<SearchPageData>>(queryKey, (old) =>
      applyVoteToCache(old, post.id, newVote),
    )
    voteMutation.mutate({ path: { postId: post.id }, body: { value: newVote } })
  }

  function update(patch: Partial<CommunitySearchParams>) {
    void navigate({ search: (prev) => ({ ...prev, ...patch }) })
  }

  const pages = search.data?.pages ?? []
  const total = pages[0]?.total ?? 0
  const posts = pages.flatMap((p) => p.posts)
  const comments = pages.flatMap((p) => p.comments)

  const hasQuery = params.q.trim().length > 0

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          update({ q: draft.trim() })
        }}
        className="relative mb-2 flex items-center gap-2 rounded-md border bg-background pl-3 focus-within:ring-1 focus-within:ring-ring"
      >
        <SearchIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
          r/{name}
        </span>
        <input
          type="search"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
          }}
          placeholder={`Search in r/${name}`}
          aria-label={`Search in r/${name}`}
          className="min-w-0 flex-1 bg-transparent py-2 pr-3 text-sm outline-none"
        />
      </form>

      {hasQuery ? (
        <Link
          to="/search"
          search={{ q: params.q, type: "posts", sort: "relevance", t: "all" }}
          className="mb-3 inline-block text-xs font-medium text-primary hover:underline"
        >
          Show results from all of ReadIt →
        </Link>
      ) : null}

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
          <p className="text-sm text-muted-foreground">Search within r/{name}.</p>
        ) : search.isLoading ? (
          <p className="text-sm text-muted-foreground">Searching…</p>
        ) : total === 0 ? (
          <p className="text-sm text-muted-foreground">
            No {params.type} found in r/{name} for “{params.q}”.
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-muted-foreground">
              {total} {total === 1 ? "result" : "results"} in r/{name}
            </p>
            <div className="flex flex-col gap-3">
              {params.type === "posts" || params.type === "media"
                ? posts.map((post) => (
                    <PostRow
                      key={post.id}
                      post={toRowPost(post)}
                      href={permalinkForPost(post)}
                      communityHref={post.community ? `/r/${post.community.name}` : undefined}
                      authorHref={post.author ? `/user/${post.author.username}` : undefined}
                      showCommunity={false}
                      onUpvote={() => {
                        vote(post, 1)
                      }}
                      onDownvote={() => {
                        vote(post, -1)
                      }}
                    />
                  ))
                : null}
              {params.type === "comments"
                ? comments.map((result) => (
                    <CommentResultCard key={result.comment.id} result={result} />
                  ))
                : null}
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
