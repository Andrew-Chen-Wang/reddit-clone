import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
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
import { mediaUrl } from "@frontends/dashboard/lib/mediaUrl"
import {
  getApiV1CommunityMemberMineOptions,
  getApiV1CommunityMemberModeratedOptions,
  getApiV1HistoryRecentCommunitiesOptions,
  getApiV1ModTeamMyInvitesOptions,
  patchApiV1CommunityMemberByCommunityIdMembershipMutation,
  postApiV1ModTeamInviteByIdAcceptMutation,
  postApiV1ModTeamInviteByIdDeclineMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import {
  Check,
  ChevronRight,
  Compass,
  Home,
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
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<Link to="/r/$name" params={{ name: community.name }} />}
        tooltip={`r/${community.name}`}
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

const MAIN_NAV = [
  { to: "/" as const, label: "Home", icon: Home },
  { to: "/popular" as const, label: "Popular", icon: TrendingUp },
  { to: "/explore" as const, label: "Explore", icon: Compass },
]

export function AppSidebar() {
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
    <Sidebar collapsible="icon" className="top-14! h-[calc(100svh-3.5rem)]!">
      <SidebarContent>
        {/* Main nav */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {MAIN_NAV.map(({ to, label, icon: Icon }) => (
                <SidebarMenuItem key={label}>
                  <SidebarMenuButton render={<Link to={to} />} tooltip={label}>
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
                className="group/label cursor-pointer"
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
                      >
                        <ShieldCheck />
                        <span>Mod Queue</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        render={<Link to="/mod/$name" params={{ name: "mod" }} />}
                        tooltip="r/Mod"
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
        <SidebarGroup>
          <SidebarGroupLabel>Recent</SidebarGroupLabel>
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
        </SidebarGroup>

        {/* Communities */}
        <Collapsible defaultOpen className="group/communities">
          <SidebarGroup>
            <SidebarGroupLabel
              render={<CollapsibleTrigger />}
              className="group/label cursor-pointer"
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

        {/* Resources */}
        <SidebarGroup>
          <SidebarGroupLabel>Resources</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
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
                  render={
                    // oxlint-disable-next-line no-html-link-for-pages -- /legal is a Next.js page outside the SPA router
                    <a href="/legal">
                      <span>ReadIt Rules</span>
                    </a>
                  }
                />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
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
