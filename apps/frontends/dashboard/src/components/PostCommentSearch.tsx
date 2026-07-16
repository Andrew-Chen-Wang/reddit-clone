import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { markdownToText } from "@ui/seo-shared/markdown-to-text"
import { getApiV1SearchOptions } from "@lib/api-client/generated/@tanstack/react-query.gen"
import { Search, X } from "lucide-react"
import { useEffect, useState } from "react"

const MIN_CHARS = 2
const DEBOUNCE_MS = 250

export type PostCommentSearchProps = {
  postId: string
  communityName: string
}

/** Compact "Search comments" box on the post detail page, scoped to this post via
 *  /v1/search?type=comments&postId=. Results link to the comment permalink (?comment=). */
export function PostCommentSearch({ postId, communityName }: PostCommentSearchProps) {
  const [draft, setDraft] = useState("")
  const [q, setQ] = useState("")

  useEffect(() => {
    const id = setTimeout(() => {
      setQ(draft.trim())
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(id)
    }
  }, [draft])

  const active = q.length >= MIN_CHARS
  const { data, isFetching } = useQuery({
    ...getApiV1SearchOptions({ query: { q, type: "comments", postId } }),
    enabled: active,
  })

  const results = data?.comments ?? []

  return (
    <div className="mb-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
          }}
          placeholder="Search comments"
          aria-label="Search comments"
          className="w-full rounded-md border bg-background py-2 pl-9 pr-9 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        {draft.length > 0 ? (
          <button
            type="button"
            aria-label="Clear comment search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => {
              setDraft("")
            }}
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {active ? (
        <div className="mt-2 flex flex-col gap-2">
          {isFetching && results.length === 0 ? (
            <p className="text-xs text-muted-foreground">Searching comments…</p>
          ) : results.length === 0 ? (
            <p className="text-xs text-muted-foreground">No comments match “{q}”.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {data?.total ?? results.length}{" "}
                {(data?.total ?? results.length) === 1 ? "match" : "matches"} in this post
              </p>
              {results.map(({ comment }) => (
                <Link
                  key={comment.id}
                  to="/r/$name/comments/$"
                  params={{ name: communityName, _splat: postId }}
                  search={{ comment: comment.id }}
                  className="rounded-md border bg-card p-2 hover:border-muted-foreground/30"
                >
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {comment.author ? (
                      <span>u/{comment.author.username}</span>
                    ) : (
                      <span>[deleted]</span>
                    )}
                    <span aria-hidden>·</span>
                    <span>{comment.score} points</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm">{markdownToText(comment.bodyMd, 200)}</p>
                </Link>
              ))}
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
