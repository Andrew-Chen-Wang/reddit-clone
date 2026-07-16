import { buttonVariants } from "@ui/base/ui/button"
import { cn } from "@ui/base/lib/utils"
import { CommunityCard } from "@ui/seo-shared/community/CommunityCard"
import { markdownToText } from "@ui/seo-shared/markdown-to-text"
import { RelativeTime } from "@ui/seo-shared/RelativeTime"
import { SearchPostList } from "@website/components/SearchPostList"
import { loadSearch, type SearchSort, type SearchType } from "@website/lib/search-ssr"
import Link from "next/link"

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

const TYPE_VALUES = TYPES.map((t) => t.value)
const SORT_VALUES = SORTS.map((s) => s.value)

function oneOf<T extends string>(value: string | undefined, allowed: T[], fallback: T): T {
  return value && (allowed as string[]).includes(value) ? (value as T) : fallback
}

function searchHref(
  q: string,
  type: SearchType,
  sort: SearchSort,
  scope: { community?: string; author?: string },
): string {
  const params = new URLSearchParams({ q, type })
  if (sort !== "relevance") params.set("sort", sort)
  if (scope.community) params.set("community", scope.community)
  if (scope.author) params.set("author", scope.author)
  return `/search?${params.toString()}`
}

function chipClass(active: boolean): string {
  return cn(
    buttonVariants({ variant: active ? "default" : "outline", size: "sm" }),
    "shrink-0 rounded-full",
  )
}

export const metadata = { title: "Search" }

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    type?: string
    sort?: string
    t?: string
    community?: string
    author?: string
  }>
}) {
  const sp = await searchParams
  const q = (sp.q ?? "").trim()
  const type = oneOf(sp.type, TYPE_VALUES, "posts")
  const sort = oneOf(sp.sort, SORT_VALUES, "relevance")
  const t = sp.t
  const community = sp.community
  const author = sp.author
  const showSort = type === "posts" || type === "comments" || type === "media"

  const result = await loadSearch(q, type, sort, t, community, author)
  const isGrid = type === "communities"
  const scope = { community, author }
  const scopeLabel = community ? `r/${community}` : author ? `u/${author}` : null

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <form action="/search" method="get" className="mb-3">
        <input type="hidden" name="type" value={type} />
        {community ? <input type="hidden" name="community" value={community} /> : null}
        {author ? <input type="hidden" name="author" value={author} /> : null}
        <div className="flex items-center gap-2 rounded-md border bg-background px-3">
          {scopeLabel ? (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
              {scopeLabel}
              <Link href={searchHref(q, type, sort, {})} aria-label="Remove scope">
                ×
              </Link>
            </span>
          ) : null}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={scopeLabel ? `Search in ${scopeLabel}` : "Search ReadIt"}
            aria-label="Search"
            className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
          />
        </div>
      </form>

      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {TYPES.map((tp) => (
          <Link
            key={tp.value}
            href={searchHref(q, tp.value, sort, scope)}
            className={chipClass(type === tp.value)}
          >
            {tp.label}
          </Link>
        ))}
      </div>

      {showSort ? (
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {SORTS.map((s) => (
            <Link
              key={s.value}
              href={searchHref(q, type, s.value, scope)}
              className={chipClass(sort === s.value)}
            >
              {s.label}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mt-5">
        {q.length === 0 ? (
          <p className="text-sm text-muted-foreground">Enter a search term to get started.</p>
        ) : result.total === 0 ? (
          <p className="text-sm text-muted-foreground">
            No {type} found for “{q}”.
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-muted-foreground">
              {result.total} {result.total === 1 ? "result" : "results"}
            </p>
            <div className={cn(isGrid ? "grid gap-3 sm:grid-cols-2" : "flex flex-col gap-3")}>
              {type === "posts" || type === "media" ? (
                <SearchPostList
                  q={q}
                  type={type}
                  sort={sort}
                  t={t ?? "all"}
                  communityId={result.communityId}
                  author={author}
                  initialPosts={result.posts}
                  initialCursor={result.nextCursor}
                />
              ) : null}

              {type === "communities"
                ? result.communities.map((communityItem) => (
                    <CommunityCard
                      key={communityItem.id}
                      community={{
                        name: communityItem.name,
                        displayName: communityItem.displayName,
                        description: communityItem.description,
                        iconUrl: null,
                        memberCount: communityItem.memberCount,
                      }}
                      joinSlot={
                        <Link href="/login" className={buttonVariants({ size: "sm" })}>
                          Join
                        </Link>
                      }
                    />
                  ))
                : null}

              {type === "comments"
                ? result.comments.map(({ comment, postTitle, communityName }) => (
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
                        href={`/r/${communityName ?? "readit"}/comments/${comment.postId}`}
                        className="mt-2 inline-block text-xs font-medium text-muted-foreground hover:underline"
                      >
                        on “{postTitle}”{communityName ? ` in r/${communityName}` : null}
                      </Link>
                    </article>
                  ))
                : null}

              {type === "profiles"
                ? result.profiles.map((profile) => (
                    <Link
                      key={profile.id}
                      href={`/user/${profile.username}`}
                      className="flex items-center gap-3 rounded-lg border bg-card p-3 hover:border-muted-foreground/30"
                    >
                      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                        {(profile.displayName ?? profile.username).charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">u/{profile.username}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {profile.karma} karma
                          {profile.about ? ` · ${markdownToText(profile.about, 80)}` : null}
                        </p>
                      </div>
                    </Link>
                  ))
                : null}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
