import { buttonVariants } from "@ui/base/ui/button"
import { cn } from "@ui/base/lib/utils"
import { markdownToText } from "@ui/seo-shared/markdown-to-text"
import { RelativeTime } from "@ui/seo-shared/RelativeTime"
import { SearchPostList } from "@website/components/SearchPostList"
import { loadSearch, type SearchSort, type SearchType } from "@website/lib/search-ssr"
import Link from "next/link"

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

const TYPE_VALUES = TYPES.map((t) => t.value)
const SORT_VALUES = SORTS.map((s) => s.value)

function oneOf<T extends string>(value: string | undefined, allowed: T[], fallback: T): T {
  return value && (allowed as string[]).includes(value) ? (value as T) : fallback
}

function searchHref(name: string, q: string, type: SearchType, sort: SearchSort): string {
  const params = new URLSearchParams({ q, type })
  if (sort !== "relevance") params.set("sort", sort)
  return `/r/${name}/search?${params.toString()}`
}

function chipClass(active: boolean): string {
  return cn(
    buttonVariants({ variant: active ? "default" : "outline", size: "sm" }),
    "shrink-0 rounded-full",
  )
}

export default async function CommunitySearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>
  searchParams: Promise<{ q?: string; type?: string; sort?: string; t?: string }>
}) {
  const { name } = await params
  const sp = await searchParams
  const q = (sp.q ?? "").trim()
  const type = oneOf(sp.type, TYPE_VALUES, "posts")
  const sort = oneOf(sp.sort, SORT_VALUES, "relevance")
  const t = sp.t

  const result = await loadSearch(q, type, sort, t, name)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <form action={`/r/${name}/search`} method="get" className="mb-2">
        <input type="hidden" name="type" value={type} />
        <div className="flex items-center gap-2 rounded-md border bg-background px-3">
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
            r/{name}
          </span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={`Search in r/${name}`}
            aria-label={`Search in r/${name}`}
            className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
          />
        </div>
      </form>

      {q.length > 0 ? (
        <Link
          href={`/search?q=${encodeURIComponent(q)}`}
          className="mb-3 inline-block text-xs font-medium text-primary hover:underline"
        >
          Show results from all of ReadIt →
        </Link>
      ) : null}

      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {TYPES.map((tp) => (
          <Link
            key={tp.value}
            href={searchHref(name, q, tp.value, sort)}
            className={chipClass(type === tp.value)}
          >
            {tp.label}
          </Link>
        ))}
      </div>

      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
        {SORTS.map((s) => (
          <Link
            key={s.value}
            href={searchHref(name, q, type, s.value)}
            className={chipClass(sort === s.value)}
          >
            {s.label}
          </Link>
        ))}
      </div>

      <div className="mt-5">
        {q.length === 0 ? (
          <p className="text-sm text-muted-foreground">Search within r/{name}.</p>
        ) : result.total === 0 ? (
          <p className="text-sm text-muted-foreground">
            No {type} found in r/{name} for “{q}”.
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-muted-foreground">
              {result.total} {result.total === 1 ? "result" : "results"} in r/{name}
            </p>
            <div className="flex flex-col gap-3">
              {type === "posts" || type === "media" ? (
                <SearchPostList
                  q={q}
                  type={type}
                  sort={sort}
                  t={t ?? "all"}
                  communityId={result.communityId}
                  initialPosts={result.posts}
                  initialCursor={result.nextCursor}
                />
              ) : null}

              {type === "comments"
                ? result.comments.map(({ comment, postTitle }) => (
                    <article key={comment.id} className="rounded-lg border bg-card p-3">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {comment.author ? (
                          <span>u/{comment.author.username}</span>
                        ) : (
                          <span>[deleted]</span>
                        )}
                        <span aria-hidden>·</span>
                        <RelativeTime date={comment.createdAt} />
                        <span aria-hidden>·</span>
                        <span>{comment.score} points</span>
                      </div>
                      <p className="mt-1.5 line-clamp-3 text-sm">
                        {markdownToText(comment.bodyMd, 320)}
                      </p>
                      <Link
                        href={`/r/${name}/comments/${comment.postId}`}
                        className="mt-2 inline-block text-xs font-medium text-muted-foreground hover:underline"
                      >
                        on “{postTitle}”
                      </Link>
                    </article>
                  ))
                : null}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
