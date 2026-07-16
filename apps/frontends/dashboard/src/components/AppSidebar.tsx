import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useRouterState } from "@tanstack/react-router"
import { cn } from "@ui/base/lib/utils"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@ui/base/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@ui/base/ui/sidebar"
import { CommunityIcon } from "@ui/seo-shared/community/CommunityIcon"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@ui/base/ui/dialog"
import { Input } from "@ui/base/ui/input"
import { Label } from "@ui/base/ui/label"
import { LoadingButton } from "@ui/base/ui/loading-button"
import { Textarea } from "@ui/base/ui/textarea"
import { mediaUrl } from "@frontends/dashboard/lib/mediaUrl"
import {
  getApiV1CommunityMemberMineOptions,
  getApiV1CommunityMemberModeratedOptions,
  getApiV1CustomFeedMineOptions,
  getApiV1HistoryRecentCommunitiesOptions,
  getApiV1ModTeamMyInvitesOptions,
  getApiV1UserMeOptions,
  patchApiV1CommunityMemberByCommunityIdMembershipMutation,
  patchApiV1CustomFeedByIdMutation,
  postApiV1CustomFeedMutation,
  postApiV1ModTeamInviteByIdAcceptMutation,
  postApiV1ModTeamInviteByIdDeclineMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import {
  Check,
  ChevronRight,
  Compass,
  Home,
  Layers,
  Plus,
  ShieldCheck,
  Star,
  TrendingUp,
  X,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { CreateCommunityWizard } from "@frontends/dashboard/components/CreateCommunityWizard"

type JoinedCommunity = {
  id: string
  name: string
  displayName: string | null
  iconImageKey: string | null
  isFavorite: boolean
}

/**
 * Sidebar spacing scale (matches reddit's compact new-UI rhythm):
 * - Menu rows are 40px tall (h-10) with the sidebar's base 16px left indent and 8px icon gap.
 * - Section headings are uppercase, muted, and letter-spaced.
 * - Row actions (favorite stars) are vertically centered against the 40px row.
 */
const MENU_ROW_CLASS = "h-10"
const SECTION_LABEL_CLASS = "uppercase tracking-wider font-semibold text-sidebar-foreground/60"
const ROW_ACTION_CLASS = "top-2.5"

function useFavoriteToggle() {
  const queryClient = useQueryClient()
  return useMutation({
    ...patchApiV1CommunityMemberByCommunityIdMembershipMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: getApiV1CommunityMemberMineOptions().queryKey,
      })
    },
    onError: () => {
      toast.error("Could not update favorite")
    },
  })
}

function FavoriteStar({ communityId, isFavorite }: { communityId: string; isFavorite: boolean }) {
  const toggle = useFavoriteToggle()
  return (
    <SidebarMenuAction
      aria-label={isFavorite ? "Unfavorite" : "Favorite"}
      className={ROW_ACTION_CLASS}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle.mutate({
          path: { communityId },
          body: { isFavorite: !isFavorite },
        })
      }}
    >
      <Star className={isFavorite ? "fill-yellow-400 text-yellow-400" : ""} />
    </SidebarMenuAction>
  )
}

function CommunityLink({
  community,
  withStar,
}: {
  community: { id: string; name: string; displayName: string | null; iconImageKey: string | null }
  withStar?: { isFavorite: boolean }
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<Link to="/r/$name" params={{ name: community.name }} />}
        tooltip={`r/${community.name}`}
        isActive={pathname === `/r/${community.name}`}
        className={MENU_ROW_CLASS}
      >
        <CommunityIcon name={community.name} iconUrl={mediaUrl(community.iconImageKey)} size="sm" />
        <span>r/{community.name}</span>
      </SidebarMenuButton>
      {withStar ? (
        <FavoriteStar communityId={community.id} isFavorite={withStar.isFavorite} />
      ) : null}
    </SidebarMenuItem>
  )
}

/** Sidebar link into a community's mod tools (distinct from the public /r link). */
function ModCommunityLink({
  community,
}: {
  community: { id: string; name: string; iconImageKey: string | null }
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<Link to="/mod/$name" params={{ name: community.name }} />}
        tooltip={`Mod r/${community.name}`}
        className={MENU_ROW_CLASS}
      >
        <CommunityIcon name={community.name} iconUrl={mediaUrl(community.iconImageKey)} size="sm" />
        <span>r/{community.name}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

/** Banner prompting the viewer to accept or decline pending moderator invites. */
function ModInvitesBanner() {
  const queryClient = useQueryClient()
  const { data } = useQuery(getApiV1ModTeamMyInvitesOptions())
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: getApiV1ModTeamMyInvitesOptions().queryKey })
    void queryClient.invalidateQueries({
      queryKey: getApiV1CommunityMemberModeratedOptions().queryKey,
    })
  }
  const accept = useMutation({
    ...postApiV1ModTeamInviteByIdAcceptMutation(),
    onSuccess: () => {
      toast.success("You're now a moderator")
      invalidate()
    },
    onError: () => {
      toast.error("Could not accept invite")
    },
  })
  const decline = useMutation({
    ...postApiV1ModTeamInviteByIdDeclineMutation(),
    onSuccess: invalidate,
    onError: () => {
      toast.error("Could not decline invite")
    },
  })

  const invites = data?.data ?? []
  if (invites.length === 0) return null

  return (
    <div className="flex flex-col gap-2 px-2 group-data-[collapsible=icon]:hidden">
      {invites.map((invite) => (
        <div key={invite.id} className="rounded-md border bg-muted/40 p-2 text-xs">
          <p>
            You&apos;ve been invited to moderate{" "}
            <span className="font-semibold">r/{invite.communityName}</span>
          </p>
          <div className="mt-1.5 flex gap-1.5">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 font-medium text-primary-foreground disabled:opacity-50"
              disabled={accept.isPending}
              onClick={() => {
                accept.mutate({ path: { id: invite.id } })
              }}
            >
              <Check className="size-3" />
              Accept
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded border px-2 py-1 font-medium disabled:opacity-50"
              disabled={decline.isPending}
              onClick={() => {
                decline.mutate({ path: { id: invite.id } })
              }}
            >
              <X className="size-3" />
              Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

type CustomFeed = {
  id: string
  name: string
  slug: string
  isFavorite: boolean
}

function CreateCustomFeedDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")

  const create = useMutation({
    ...postApiV1CustomFeedMutation(),
    onSuccess: () => {
      toast.success("Custom feed created")
      setName("")
      setDescription("")
      onOpenChange(false)
      void queryClient.invalidateQueries({ queryKey: getApiV1CustomFeedMineOptions().queryKey })
    },
    onError: () => {
      toast.error("Could not create custom feed")
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setName("")
          setDescription("")
        }
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create custom feed</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="feed-name">Name</Label>
            <Input
              id="feed-name"
              value={name}
              maxLength={50}
              onChange={(e) => {
                setName(e.target.value)
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="feed-description">Description</Label>
            <Textarea
              id="feed-description"
              rows={3}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <LoadingButton
            loading={create.isPending}
            disabled={name.trim() === ""}
            onClick={() => {
              create.mutate({
                body: {
                  name: name.trim(),
                  description: description.trim() === "" ? null : description.trim(),
                },
              })
            }}
          >
            Create
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CustomFeedStar({ feedId, isFavorite }: { feedId: string; isFavorite: boolean }) {
  const queryClient = useQueryClient()
  const toggle = useMutation({
    ...patchApiV1CustomFeedByIdMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: getApiV1CustomFeedMineOptions().queryKey })
    },
    onError: () => {
      toast.error("Could not update favorite")
    },
  })
  return (
    <SidebarMenuAction
      aria-label={isFavorite ? "Unfavorite" : "Favorite"}
      className={ROW_ACTION_CLASS}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle.mutate({ path: { id: feedId }, body: { isFavorite: !isFavorite } })
      }}
    >
      <Star className={isFavorite ? "fill-yellow-400 text-yellow-400" : ""} />
    </SidebarMenuAction>
  )
}

function CustomFeedsSection() {
  const [createOpen, setCreateOpen] = useState(false)
  const { data: me } = useQuery(getApiV1UserMeOptions())
  const { data: feedsData } = useQuery(getApiV1CustomFeedMineOptions())
  const feeds = (feedsData?.data ?? []) as CustomFeed[]
  const username = me?.username

  return (
    <Collapsible defaultOpen className="group/feeds">
      <SidebarGroup>
        <SidebarGroupLabel
          render={<CollapsibleTrigger />}
          className={cn("group/label cursor-pointer", SECTION_LABEL_CLASS)}
        >
          Custom Feeds
          <ChevronRight className="ml-auto transition-transform group-data-[panel-open]/label:rotate-90" />
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => {
                    setCreateOpen(true)
                  }}
                  tooltip="Create Custom Feed"
                  className={MENU_ROW_CLASS}
                >
                  <Plus />
                  <span>Create Custom Feed</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {username
                ? feeds.map((feed) => (
                    <SidebarMenuItem key={feed.id}>
                      <SidebarMenuButton
                        render={
                          <Link to="/feed/$username/$slug" params={{ username, slug: feed.slug }} />
                        }
                        tooltip={feed.name}
                        className={MENU_ROW_CLASS}
                      >
                        <Layers />
                        <span>{feed.name}</span>
                      </SidebarMenuButton>
                      <CustomFeedStar feedId={feed.id} isFavorite={feed.isFavorite} />
                    </SidebarMenuItem>
                  ))
                : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
      <CreateCustomFeedDialog open={createOpen} onOpenChange={setCreateOpen} />
    </Collapsible>
  )
}

const MAIN_NAV = [
  { to: "/" as const, label: "Home", icon: Home },
  { to: "/popular" as const, label: "Popular", icon: TrendingUp },
  { to: "/explore" as const, label: "Explore", icon: Compass },
]

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [wizardOpen, setWizardOpen] = useState(false)
  const { data: mine } = useQuery(getApiV1CommunityMemberMineOptions())
  const { data: moderated } = useQuery(getApiV1CommunityMemberModeratedOptions())
  const { data: recent } = useQuery(getApiV1HistoryRecentCommunitiesOptions())
  const { data: invites } = useQuery(getApiV1ModTeamMyInvitesOptions())

  const joined = ((mine?.data ?? []) as JoinedCommunity[]).toSorted((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  })
  const moderatedCommunities = moderated?.data ?? []
  const recentCommunities = (recent?.data ?? []).slice(0, 5)
  const hasInvites = (invites?.data ?? []).length > 0

  return (
    <Sidebar collapsible="offcanvas" className="top-14! h-[calc(100svh-3.5rem)]!">
      <SidebarContent>
        {/* Main nav */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {MAIN_NAV.map(({ to, label, icon: Icon }) => (
                <SidebarMenuItem key={label}>
                  <SidebarMenuButton
                    render={<Link to={to} />}
                    tooltip={label}
                    isActive={pathname === to}
                    className={MENU_ROW_CLASS}
                  >
                    <Icon />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Moderation */}
        {moderatedCommunities.length > 0 || hasInvites ? (
          <Collapsible defaultOpen className="group/moderation">
            <SidebarGroup>
              <SidebarGroupLabel
                render={<CollapsibleTrigger />}
                className={cn("group/label cursor-pointer", SECTION_LABEL_CLASS)}
              >
                Moderation
                <ChevronRight className="ml-auto transition-transform group-data-[panel-open]/label:rotate-90" />
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <ModInvitesBanner />
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        render={<Link to="/mod/$name" params={{ name: "mod" }} />}
                        tooltip="Mod Queue"
                        className={MENU_ROW_CLASS}
                      >
                        <ShieldCheck />
                        <span>Mod Queue</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        render={<Link to="/r/mod" />}
                        tooltip="r/Mod"
                        className={MENU_ROW_CLASS}
                      >
                        <ShieldCheck />
                        <span>r/Mod</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    {moderatedCommunities.map((community) => (
                      <ModCommunityLink key={community.id} community={community} />
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ) : null}

        {/* Recent */}
        <Collapsible defaultOpen className="group/recent">
          <SidebarGroup>
            <SidebarGroupLabel
              render={<CollapsibleTrigger />}
              className={cn("group/label cursor-pointer", SECTION_LABEL_CLASS)}
            >
              Recent
              <ChevronRight className="ml-auto transition-transform group-data-[panel-open]/label:rotate-90" />
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                {recentCommunities.length > 0 ? (
                  <SidebarMenu>
                    {recentCommunities.map((community) => (
                      <CommunityLink
                        key={community.communityId}
                        community={{
                          id: community.communityId,
                          name: community.name,
                          displayName: null,
                          iconImageKey: community.iconImageKey,
                        }}
                      />
                    ))}
                  </SidebarMenu>
                ) : (
                  <p className="px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                    Communities you visit will show up here.
                  </p>
                )}
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Communities */}
        <Collapsible defaultOpen className="group/communities">
          <SidebarGroup>
            <SidebarGroupLabel
              render={<CollapsibleTrigger />}
              className={cn("group/label cursor-pointer", SECTION_LABEL_CLASS)}
            >
              Communities
              <ChevronRight className="ml-auto transition-transform group-data-[panel-open]/label:rotate-90" />
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => {
                        setWizardOpen(true)
                      }}
                      tooltip="Create Community"
                      className={MENU_ROW_CLASS}
                    >
                      <Plus />
                      <span>Create Community</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {joined.map((community) => (
                    <CommunityLink
                      key={community.id}
                      community={community}
                      withStar={{ isFavorite: community.isFavorite }}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Custom Feeds */}
        <CustomFeedsSection />

        {/* Resources */}
        <SidebarGroup>
          <SidebarGroupLabel className={SECTION_LABEL_CLASS}>Resources</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className={MENU_ROW_CLASS}
                  render={
                    // oxlint-disable-next-line no-html-link-for-pages -- /about is a Next.js page outside the SPA router
                    <a href="/about">
                      <span>About ReadIt</span>
                    </a>
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className={MENU_ROW_CLASS}
                  render={
                    // oxlint-disable-next-line no-html-link-for-pages -- /rules is a Next.js page outside the SPA router
                    <a href="/rules">
                      <span>ReadIt Rules</span>
                    </a>
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className={MENU_ROW_CLASS}
                  render={
                    // oxlint-disable-next-line no-html-link-for-pages -- /legal is a Next.js page outside the SPA router
                    <a href="/legal">
                      <span>Privacy Policy</span>
                    </a>
                  }
                />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <CreateCommunityWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </Sidebar>
  )
}
