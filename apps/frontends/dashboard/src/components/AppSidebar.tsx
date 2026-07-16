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
import {
  getApiV1CommunityMemberMineOptions,
  getApiV1CommunityMemberModeratedOptions,
  patchApiV1CommunityMemberByCommunityIdMembershipMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import {
  ChevronRight,
  Compass,
  Home,
  Plus,
  ShieldCheck,
  Star,
  TrendingUp,
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

function FavoriteStar({
  communityId,
  isFavorite,
}: {
  communityId: string
  isFavorite: boolean
}) {
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
        <CommunityIcon name={community.name} iconUrl={community.iconImageKey} size="sm" />
        <span>r/{community.name}</span>
      </SidebarMenuButton>
      {withStar ? (
        <FavoriteStar communityId={community.id} isFavorite={withStar.isFavorite} />
      ) : null}
    </SidebarMenuItem>
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

  const joined = [...((mine?.data ?? []) as JoinedCommunity[])].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  })
  const moderatedCommunities = moderated?.data ?? []

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
        {moderatedCommunities.length > 0 ? (
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
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton disabled tooltip="Mod Queue (coming soon)">
                        <ShieldCheck />
                        <span>Mod Queue</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton disabled tooltip="r/Mod (coming soon)">
                        <ShieldCheck />
                        <span>r/Mod</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    {moderatedCommunities.map((community) => (
                      <CommunityLink key={community.id} community={community} />
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
            <p className="px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
              Communities you visit will show up here.
            </p>
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
                      onClick={() => setWizardOpen(true)}
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
                <SidebarMenuButton render={<a href="/about" />}>
                  <span>About ReadIt</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton render={<a href="/legal" />}>
                  <span>ReadIt Rules</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton render={<a href="/legal" />}>
                  <span>Privacy Policy</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <CreateCommunityWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </Sidebar>
  )
}
