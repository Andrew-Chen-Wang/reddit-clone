import { useQuery } from "@tanstack/react-query"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import { CommunityIcon } from "@ui/seo-shared/community/CommunityIcon"
import { formatCompactNumber } from "@ui/seo-shared/format-number"
import { getApiV1SearchSuggestOptions } from "@lib/api-client/generated/@tanstack/react-query.gen"
import { Search, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"

const MIN_CHARS = 2
const DEBOUNCE_MS = 200

type Scope = { kind: "community"; name: string } | { kind: "profile"; username: string } | null

function scopeFromPath(pathname: string): Scope {
  const community = /^\/r\/([^/]+)/.exec(pathname)
  if (community) return { kind: "community", name: decodeURIComponent(community[1]) }
  const profile = /^\/u\/([^/]+)/.exec(pathname)
  if (profile) return { kind: "profile", username: decodeURIComponent(profile[1]) }
  return null
}

function scopeLabelOf(scope: NonNullable<Scope>): string {
  return scope.kind === "community" ? `r/${scope.name}` : `u/${scope.username}`
}

/** Nav search box: typeahead dropdown (/v1/search/suggest) + a removable scope chip when
 *  the viewer is inside a community or profile, so submitting scopes the search. */
export function SearchSuggest() {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [draft, setDraft] = useState("")
  const [debounced, setDebounced] = useState("")
  const [open, setOpen] = useState(false)
  const [scopeDismissed, setScopeDismissed] = useState(false)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setScopeDismissed(false)
  }, [pathname])

  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(draft.trim())
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(id)
    }
  }, [draft])

  const scope = scopeDismissed ? null : scopeFromPath(pathname)
  const scopeLabel = scope ? scopeLabelOf(scope) : null

  const { data } = useQuery({
    ...getApiV1SearchSuggestOptions({ query: { q: debounced } }),
    enabled: debounced.length >= MIN_CHARS,
  })

  const communities = data?.communities ?? []
  const profiles = data?.profiles ?? []
  const hasResults = communities.length > 0 || profiles.length > 0
  const showDropdown = open && debounced.length >= MIN_CHARS && hasResults

  function goToSearch() {
    const q = draft.trim()
    if (q.length === 0) return
    setOpen(false)
    const base = { q, type: "posts", sort: "relevance", t: "all" } as const
    if (scope?.kind === "community") {
      void navigate({ to: "/r/$name/search", params: { name: scope.name }, search: base })
    } else if (scope?.kind === "profile") {
      void navigate({ to: "/search", search: { ...base, author: scope.username } })
    } else {
      void navigate({ to: "/search", search: base })
    }
  }

  return (
    <div className="relative w-full max-w-2xl">
      <div className="flex h-10 items-center gap-2 rounded-full bg-muted/60 pl-4 focus-within:bg-background focus-within:ring-1 focus-within:ring-ring">
        <Search className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
        {scopeLabel ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
            {scopeLabel}
            <button
              type="button"
              aria-label="Remove search scope"
              className="rounded-full hover:bg-background"
              onClick={() => {
                setScopeDismissed(true)
              }}
            >
              <X className="size-3" />
            </button>
          </span>
        ) : null}
        <input
          type="search"
          placeholder={scopeLabel ? `Search in ${scopeLabel}` : "Search ReadIt"}
          aria-label="Search"
          className="min-w-0 flex-1 bg-transparent py-2 pr-3 text-sm outline-none"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            setOpen(true)
          }}
          onBlur={() => {
            blurTimer.current = setTimeout(() => {
              setOpen(false)
            }, 150)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") goToSearch()
            if (e.key === "Escape") setOpen(false)
          }}
        />
      </div>
      {showDropdown ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover shadow-md">
          {communities.length > 0 ? (
            <div className="py-1">
              <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Communities
              </p>
              {communities.map((community) => (
                <button
                  key={community.id}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-accent"
                  onMouseDown={(e) => {
                    e.preventDefault()
                  }}
                  onClick={() => {
                    setOpen(false)
                    void navigate({ to: "/r/$name", params: { name: community.name } })
                  }}
                >
                  <CommunityIcon name={community.name} iconUrl={null} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm">r/{community.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatCompactNumber(community.memberCount)}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          {profiles.length > 0 ? (
            <div className="border-t py-1">
              <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                People
              </p>
              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-accent"
                  onMouseDown={(e) => {
                    e.preventDefault()
                  }}
                  onClick={() => {
                    setOpen(false)
                    void navigate({
                      to: "/user/$username",
                      params: { username: profile.username },
                    })
                  }}
                >
                  <span className="min-w-0 flex-1 truncate text-sm">u/{profile.username}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
