import { AnonFeed } from "@website/components/AnonFeed"
import { FeedSortTabs } from "@website/components/FeedSortTabs"
import { loadPopularFeed, normalizeSort } from "@website/lib/feed-ssr"

const POPULAR_SORTS = [
  { value: "hot", label: "Hot" },
  { value: "new", label: "New" },
  { value: "top", label: "Top" },
  { value: "rising", label: "Rising" },
  { value: "controversial", label: "Controversial" },
]
const ALLOWED = ["hot", "new", "top", "rising", "controversial"] as const

export const metadata = { title: "Popular" }

export default async function PopularPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; t?: string }>
}) {
  const { sort: sortParam, t } = await searchParams
  const sort = normalizeSort(sortParam, ALLOWED)
  const { posts, initialCursor } = await loadPopularFeed(sort, t, null)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="mb-3 text-2xl font-bold">Popular posts</h1>
      <div className="mb-3">
        <FeedSortTabs basePath="/popular" current={sort} sorts={POPULAR_SORTS} t={t} />
      </div>
      {posts.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center">
          <p className="text-sm font-medium text-muted-foreground">Nothing here yet</p>
        </div>
      ) : (
        <AnonFeed
          source={{ kind: "popular" }}
          sort={sort}
          t={t ?? "day"}
          initialPosts={posts}
          initialCursor={initialCursor}
        />
      )}
    </div>
  )
}
