import { useQuery } from "@tanstack/react-query"
import { Button } from "@ui/base/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@ui/base/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ui/base/ui/dropdown-menu"
import { CommunityIcon } from "@ui/seo-shared/community/CommunityIcon"
import { SeoLink } from "@ui/seo-shared/_internal/seo-link"
import { mediaUrl } from "@frontends/dashboard/lib/mediaUrl"
import { getApiV1ModLogByCommunityIdOptions } from "@lib/api-client/generated/@tanstack/react-query.gen"
import { ChevronDown, ExternalLink, X } from "lucide-react"
import { useState } from "react"

export type ModCommunity = {
  id: string
  name: string
  displayName: string | null
  iconImageKey: string | null
}

/**
 * "Insights and activity" right rail, mirroring reddit's mod-queue insights
 * panel. Shown on both the aggregate (/mod/mod) and single-community mod views.
 *
 * Stats are derived best-effort from the mod log for the selected community.
 * TODO(backend): a dedicated `GET /v1/mod/insights/{communityId}?window=7d`
 * endpoint returning { activeMods, publishedPosts, publishedComments,
 * reportsOnContent } would give exact figures instead of these mod-log proxies.
 */
export function ModInsightsRail({
  communities,
  initialCommunityId,
}: {
  communities: ModCommunity[]
  initialCommunityId?: string
}) {
  const [dismissed, setDismissed] = useState(false)
  const [selectedId, setSelectedId] = useState<string | undefined>(
    initialCommunityId ?? communities[0]?.id,
  )

  if (dismissed) return null

  const selected = communities.find((c) => c.id === selectedId) ?? communities[0]

  return (
    <aside className="w-full shrink-0 lg:w-72">
      <div className="sticky top-4 flex flex-col gap-3 rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Insights and activity</h2>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Hide insights"
            onClick={() => {
              setDismissed(true)
            }}
          >
            <X className="size-4" />
          </Button>
        </div>

        <Last7DaysSection communities={communities} selected={selected} onSelect={setSelectedId} />

        <NoActiveModsSection communities={communities} />
      </div>
    </aside>
  )
}

function has(e: { action: string }, needle: string): boolean {
  return e.action.toLowerCase().includes(needle)
}

function Last7DaysSection({
  communities,
  selected,
  onSelect,
}: {
  communities: ModCommunity[]
  selected: ModCommunity | undefined
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(true)

  const { data } = useQuery({
    ...getApiV1ModLogByCommunityIdOptions({ path: { communityId: selected?.id ?? "" } }),
    enabled: Boolean(selected?.id),
  })

  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  const recent = (data?.data ?? []).filter((e) => new Date(e.createdAt).getTime() >= cutoff)

  const activeMods = new Set(recent.map((e) => e.modUserId).filter(Boolean)).size
  const publishedPosts = recent.filter((e) => has(e, "approve") && e.targetPostId).length
  const publishedComments = recent.filter((e) => has(e, "approve") && e.targetCommentId).length
  const reports = recent.filter((e) => has(e, "remove") || has(e, "report")).length

  const stats: { label: string; value: number }[] = [
    { label: "Active mods", value: activeMods },
    { label: "Published posts", value: publishedPosts },
    { label: "Published comments", value: publishedComments },
    { label: "Reports on posts and comments", value: reports },
  ]

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex flex-col gap-2">
        <CollapsibleTrigger
          render={
            <button
              type="button"
              className="flex w-full items-center justify-between text-left text-sm font-medium"
            >
              Last 7 days
              <ChevronDown
                className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
              />
            </button>
          }
        />
        <CollapsibleContent>
          <div className="flex flex-col gap-3">
            {communities.length > 1 && selected ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" size="sm" className="w-full justify-between">
                      <span className="flex min-w-0 items-center gap-2">
                        <CommunityIcon
                          name={selected.name}
                          iconUrl={mediaUrl(selected.iconImageKey)}
                          size="sm"
                        />
                        <span className="truncate">r/{selected.name}</span>
                      </span>
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
                  {communities.map((c) => (
                    <DropdownMenuItem
                      key={c.id}
                      onClick={() => {
                        onSelect(c.id)
                      }}
                    >
                      <CommunityIcon name={c.name} iconUrl={mediaUrl(c.iconImageKey)} size="sm" />
                      r/{c.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : selected ? (
              <div className="flex items-center gap-2 text-sm">
                <CommunityIcon
                  name={selected.name}
                  iconUrl={mediaUrl(selected.iconImageKey)}
                  size="sm"
                />
                <span className="truncate">r/{selected.name}</span>
              </div>
            ) : null}

            <div className="flex flex-col gap-2 text-sm">
              {stats.map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="font-medium tabular-nums">{s.value}</span>
                </div>
              ))}
            </div>

            {selected ? (
              <SeoLink
                href={`/mod/${selected.name}/log`}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                View more insights
                <ExternalLink className="size-3" />
              </SeoLink>
            ) : null}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

function NoActiveModsSection({ communities }: { communities: ModCommunity[] }) {
  const [open, setOpen] = useState(true)

  if (communities.length === 0) return null

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex flex-col gap-2 border-t pt-3">
        <CollapsibleTrigger
          render={
            <button
              type="button"
              className="flex w-full items-center justify-between text-left text-sm font-medium"
            >
              No mods are active
              <ChevronDown
                className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
              />
            </button>
          }
        />
        <CollapsibleContent>
          <div className="flex flex-col gap-2 pt-1">
            {communities.map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <CommunityIcon name={c.name} iconUrl={mediaUrl(c.iconImageKey)} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">r/{c.name}</p>
                  <p className="text-xs text-muted-foreground">No recent actions</p>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
