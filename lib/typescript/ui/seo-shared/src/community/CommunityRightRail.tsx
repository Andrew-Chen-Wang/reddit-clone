import type { ReactNode } from "react"
import { Mail } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@ui/base/ui/accordion"
import { Avatar, AvatarFallback, AvatarImage } from "@ui/base/ui/avatar"
import { buttonVariants } from "@ui/base/ui/button"
import { Card, CardContent } from "@ui/base/ui/card"
import { cn } from "@ui/base/lib/utils"
import { SeoLink } from "@ui/seo-shared/_internal/seo-link"
import { formatCompactNumber } from "@ui/seo-shared/format-number"
import { visibilityMeta } from "@ui/seo-shared/community/visibility"
import { CommunityIcon } from "@ui/seo-shared/community/CommunityIcon"
import { Markdown } from "@ui/seo-shared/Markdown"

export type CommunityRightRailRule = {
  id: string
  name: string
  description: string | null
  position: number
}

export type CommunityRightRailModerator = {
  userId: string
  username: string
  avatarImageKey: string | null
}

export type CommunityRightRailBookmark = {
  id: string
  label: string
  url: string
}

export type CommunityRightRailWidget = {
  id: string
  title: string
  bodyMd: string
}

export type CommunityRightRailRelated = {
  id: string
  name: string
  displayName: string | null
  iconUrl: string | null
  memberCount: number
}

export type CommunityRightRailProps = {
  displayName: string | null
  name: string
  description: string
  visibility: string
  memberCount: number
  createdAt: string | Date
  rules: CommunityRightRailRule[]
  moderators: CommunityRightRailModerator[]
  bookmarks?: CommunityRightRailBookmark[]
  widgets?: CommunityRightRailWidget[]
  related?: CommunityRightRailRelated[]
  /** Interactive "USER FLAIR" card, supplied by authenticated frontends. */
  userFlairSlot?: ReactNode
  /** "VIEW BY POST TYPES" flair-filter card, supplied when the community has post flair. */
  postTypesSlot?: ReactNode
}

const EMPTY_BOOKMARKS: CommunityRightRailBookmark[] = []
const EMPTY_WIDGETS: CommunityRightRailWidget[] = []
const EMPTY_RELATED: CommunityRightRailRelated[] = []

function formatCreated(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

/** Presentational community "about" sidebar rail. Props-only. */
export function CommunityRightRail({
  displayName,
  name,
  description,
  visibility,
  memberCount,
  createdAt,
  rules,
  moderators,
  bookmarks = EMPTY_BOOKMARKS,
  widgets = EMPTY_WIDGETS,
  related = EMPTY_RELATED,
  userFlairSlot,
  postTypesSlot,
}: CommunityRightRailProps) {
  const meta = visibilityMeta(visibility)
  const VisibilityIcon = meta.icon
  const shownMods = moderators.slice(0, 5)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div>
            <h2 className="text-base font-semibold">{displayName ?? `r/${name}`}</h2>
            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>

          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Members</dt>
              <dd className="font-medium">{formatCompactNumber(memberCount)}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Created</dt>
              <dd className="font-medium">{formatCreated(createdAt)}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Visibility</dt>
              <dd className="flex items-center gap-1.5 font-medium">
                <VisibilityIcon className="size-4" />
                {meta.label}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {userFlairSlot}

      {bookmarks.length > 0 ? (
        <Card>
          <CardContent className="flex flex-wrap gap-2 pt-6">
            {bookmarks.map((bookmark) => (
              <a
                key={bookmark.id}
                href={bookmark.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full border bg-muted/40 px-3 py-1.5 text-sm font-medium hover:bg-muted"
              >
                {bookmark.label}
              </a>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {rules.length > 0 ? (
        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Rules
            </h2>
            <Accordion>
              {rules.map((rule, index) =>
                rule.description ? (
                  <AccordionItem key={rule.id} value={rule.id}>
                    <AccordionTrigger className="text-left text-sm font-normal">
                      <span className="flex gap-2 pr-2">
                        <span className="shrink-0 text-muted-foreground">{index + 1}</span>
                        <span>{rule.name}</span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="pl-6 text-sm text-muted-foreground">
                      {rule.description}
                    </AccordionContent>
                  </AccordionItem>
                ) : (
                  <div key={rule.id} className="flex gap-2 py-2.5 text-sm not-last:border-b">
                    <span className="shrink-0 text-muted-foreground">{index + 1}</span>
                    <span>{rule.name}</span>
                  </div>
                ),
              )}
            </Accordion>
          </CardContent>
        </Card>
      ) : null}

      {postTypesSlot}

      {moderators.length > 0 ? (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Moderators
            </h2>
            <SeoLink
              href={`/message-mods/${name}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}
            >
              <Mail className="size-4" />
              Message Mods
            </SeoLink>
            <ul className="flex flex-col gap-2">
              {shownMods.map((mod) => {
                const initial = mod.username.charAt(0).toUpperCase()
                return (
                  <li key={mod.userId}>
                    <SeoLink
                      href={`/user/${mod.username}`}
                      className="flex items-center gap-2 text-sm hover:underline"
                    >
                      <Avatar className="size-6">
                        {mod.avatarImageKey ? (
                          <AvatarImage src={mod.avatarImageKey} alt="" />
                        ) : null}
                        <AvatarFallback className="text-xs">{initial}</AvatarFallback>
                      </Avatar>
                      <span className="truncate">u/{mod.username}</span>
                    </SeoLink>
                  </li>
                )
              })}
            </ul>
            {moderators.length > shownMods.length ? (
              <SeoLink
                href={`/r/${name}/moderators`}
                className="text-sm text-primary hover:underline"
              >
                View all moderators
              </SeoLink>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {widgets.map((widget) => (
        <Card key={widget.id}>
          <CardContent className="flex flex-col gap-2 pt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {widget.title}
            </h2>
            <Markdown content={widget.bodyMd} />
          </CardContent>
        </Card>
      ))}

      {related.length > 0 ? (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Related Communities
            </h2>
            <ul className="flex flex-col gap-2">
              {related.map((community) => (
                <li key={community.id}>
                  <SeoLink
                    href={`/r/${community.name}`}
                    className="flex items-center gap-2 text-sm hover:underline"
                  >
                    <CommunityIcon name={community.name} iconUrl={community.iconUrl} size="sm" />
                    <span className="min-w-0 flex-1 truncate">r/{community.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatCompactNumber(community.memberCount)}
                    </span>
                  </SeoLink>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
