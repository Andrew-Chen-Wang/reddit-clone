import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { Button, buttonVariants } from "@ui/base/ui/button"
import { cn } from "@ui/base/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ui/base/ui/dropdown-menu"
import { CommunityHeader } from "@ui/seo-shared/community/CommunityHeader"
import { CommunityRightRail } from "@ui/seo-shared/community/CommunityRightRail"
import { CommunityPostTypesCard } from "@ui/seo-shared/community/CommunityPostTypesCard"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@ui/base/ui/dialog"
import { Markdown } from "@ui/seo-shared/Markdown"
import { PostFeed, type FeedPost } from "@frontends/dashboard/components/PostFeed"
import { CommunityAppearanceDialog } from "@frontends/dashboard/components/CommunityAppearanceDialog"
import { CommunityUserFlairCard } from "@frontends/dashboard/components/CommunityUserFlairCard"
import { mediaUrl } from "@frontends/dashboard/lib/mediaUrl"
import {
  getApiV1CommunityByNameOptions,
  getApiV1CommunityMemberMineOptions,
  getApiV1CommunityWidgetByCommunityNameOptions,
  getApiV1FlairByCommunityIdPostTemplatesOptions,
  patchApiV1CommunityMemberByCommunityIdMembershipMutation,
  postApiV1CommunityMemberByCommunityIdJoinMutation,
  postApiV1CommunityMemberByCommunityIdLeaveMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { Bell, Check, ImagePlus, Plus, ShieldHalf, Star } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

export const Route = createFileRoute("/r/$name")({
  component: CommunityPage,
  validateSearch: (search: Record<string, unknown>): { flair?: string } => ({
    flair: typeof search.flair === "string" ? search.flair : undefined,
  }),
})

type NotificationLevel = "off" | "low" | "frequent"

const NOTIFICATION_LABELS: Record<NotificationLevel, string> = {
  off: "Off",
  low: "Low",
  frequent: "Frequent",
}

const COMMUNITY_SORTS = [
  { value: "hot", label: "Hot" },
  { value: "new", label: "New" },
  { value: "top", label: "Top" },
  { value: "rising", label: "Rising" },
  { value: "controversial", label: "Controversial" },
]

function CommunityPage() {
  const { name } = Route.useParams()
  const { flair: activeFlairId } = Route.useSearch()
  const queryClient = useQueryClient()
  const [appearanceOpen, setAppearanceOpen] = useState(false)
  const [welcomeOpen, setWelcomeOpen] = useState(false)
  const communityQuery = useQuery(getApiV1CommunityByNameOptions({ path: { name } }))
  const widgetsQuery = useQuery(
    getApiV1CommunityWidgetByCommunityNameOptions({ path: { communityName: name } }),
  )
  const communityIdForFlair = communityQuery.data?.id
  const postFlairQuery = useQuery({
    ...getApiV1FlairByCommunityIdPostTemplatesOptions({
      path: { communityId: communityIdForFlair ?? "" },
    }),
    enabled: Boolean(communityIdForFlair),
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: getApiV1CommunityByNameOptions({ path: { name } }).queryKey,
    })
    void queryClient.invalidateQueries({
      queryKey: getApiV1CommunityMemberMineOptions().queryKey,
    })
  }

  const joinMutation = useMutation({
    ...postApiV1CommunityMemberByCommunityIdJoinMutation(),
    onSuccess: (result) => {
      invalidate()
      if (result.requested)
        toast.success("Request sent", { description: "A moderator will review it." })
      if (result.joined && communityQuery.data?.welcomeMessage) setWelcomeOpen(true)
    },
    onError: () => toast.error("Could not join community"),
  })
  const leaveMutation = useMutation({
    ...postApiV1CommunityMemberByCommunityIdLeaveMutation(),
    onSuccess: invalidate,
    onError: () => toast.error("Could not leave community"),
  })
  const membershipMutation = useMutation({
    ...patchApiV1CommunityMemberByCommunityIdMembershipMutation(),
    onSuccess: invalidate,
    onError: () => toast.error("Could not update membership"),
  })

  if (communityQuery.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  const community = communityQuery.data
  if (communityQuery.isError || !community) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-5xl flex-col items-center justify-center gap-2 px-4 text-center">
        <h1 className="text-xl font-semibold">Community not found</h1>
        <p className="text-sm text-muted-foreground">
          This community is private or doesn&apos;t exist.
        </p>
      </div>
    )
  }

  const { viewer } = community
  const communityId = community.id
  const isPublic = community.visibility === "public"
  const pending = membershipMutation.isPending || joinMutation.isPending || leaveMutation.isPending

  function toggleFavorite() {
    membershipMutation.mutate({
      path: { communityId },
      body: { isFavorite: !viewer.isFavorite },
    })
  }

  function setNotificationLevel(level: NotificationLevel) {
    membershipMutation.mutate({ path: { communityId }, body: { notificationLevel: level } })
  }

  const joinSlot = viewer.isMember ? (
    <Button
      variant="outline"
      size="sm"
      className="group"
      disabled={pending}
      onClick={() => {
        leaveMutation.mutate({ path: { communityId } })
      }}
    >
      <span className="group-hover:hidden">Joined</span>
      <span className="hidden group-hover:inline">Leave</span>
    </Button>
  ) : viewer.pendingJoinRequest ? (
    <Button variant="outline" size="sm" disabled>
      Requested
    </Button>
  ) : (
    <Button
      size="sm"
      disabled={pending}
      onClick={() => {
        joinMutation.mutate({ path: { communityId } })
      }}
    >
      {isPublic ? "Join" : "Request to Join"}
    </Button>
  )

  const bellSlot = viewer.isMember ? (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Notification settings"
        className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }))}
      >
        <Bell className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(Object.keys(NOTIFICATION_LABELS) as NotificationLevel[]).map((level) => (
          <DropdownMenuItem
            key={level}
            onClick={() => {
              setNotificationLevel(level)
            }}
          >
            {viewer.notificationLevel === level ? (
              <Check className="size-4" />
            ) : (
              <span className="size-4" />
            )}
            {NOTIFICATION_LABELS[level]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null

  const createPostSlot = (
    <Link
      to="/r/$name/submit"
      params={{ name: community.name }}
      className={buttonVariants({ variant: "outline", size: "sm" })}
    >
      <Plus className="size-4" />
      Create Post
    </Link>
  )

  const extraSlot = (
    <>
      {viewer.isMember ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={viewer.isFavorite ? "Unfavorite" : "Favorite"}
          disabled={pending}
          onClick={toggleFavorite}
        >
          <Star className={cn("size-4", viewer.isFavorite && "fill-yellow-400 text-yellow-400")} />
        </Button>
      ) : null}
      {viewer.isModerator ? (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setAppearanceOpen(true)
            }}
          >
            <ImagePlus className="size-4" />
            Edit appearance
          </Button>
          <Link
            to="/mod/$name"
            params={{ name: community.name }}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <ShieldHalf className="size-4" />
            Mod Tools
          </Link>
        </>
      ) : null}
    </>
  )

  return (
    <div className="pb-10">
      <CommunityHeader
        community={{
          name: community.name,
          displayName: community.displayName,
          iconUrl: mediaUrl(community.iconImageKey),
          bannerUrl: mediaUrl(community.bannerImageKey),
          memberCount: community.memberCount,
        }}
        joinSlot={joinSlot}
        createPostSlot={createPostSlot}
        bellSlot={bellSlot}
        extraSlot={extraSlot}
      />

      {viewer.isModerator ? (
        <CommunityAppearanceDialog
          open={appearanceOpen}
          onOpenChange={setAppearanceOpen}
          communityId={communityId}
          communityName={community.name}
          iconImageKey={community.iconImageKey}
          bannerImageKey={community.bannerImageKey}
          onUpdated={invalidate}
        />
      ) : null}

      <div className="mx-auto mt-4 flex w-full max-w-5xl flex-col gap-6 px-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          <PostFeed
            source={{ kind: "community", name: community.name, flairTemplateId: activeFlairId }}
            sorts={COMMUNITY_SORTS}
            defaultSort="hot"
            showCommunity={false}
            permalinkFor={(post: FeedPost) => `/r/${community.name}/comments/${post.id}`}
            emptyTitle="This community doesn't have any posts yet"
            emptyDescription={`Be the first to share something with r/${community.name}.`}
          />
        </div>

        <aside className="w-full shrink-0 lg:w-80">
          <CommunityRightRail
            name={community.name}
            displayName={community.displayName}
            description={community.description}
            visibility={community.visibility}
            memberCount={community.memberCount}
            createdAt={community.createdAt}
            rules={community.rules}
            moderators={community.moderators.map((m) => ({
              userId: m.userId,
              username: m.username,
              avatarImageKey: m.avatarImageKey,
            }))}
            bookmarks={widgetsQuery.data?.bookmarks}
            widgets={widgetsQuery.data?.widgets}
            related={widgetsQuery.data?.related.map((r) => ({
              id: r.id,
              name: r.name,
              displayName: r.displayName,
              iconUrl: mediaUrl(r.iconImageKey),
              memberCount: r.memberCount,
            }))}
            userFlairSlot={
              viewer.isMember ? (
                <CommunityUserFlairCard communityId={communityId} currentFlair={viewer.userFlair} />
              ) : null
            }
            postTypesSlot={
              <CommunityPostTypesCard
                templates={postFlairQuery.data?.data ?? []}
                activeFlairId={activeFlairId ?? null}
                renderPill={({ template, active, className, style, children }) => (
                  <Link
                    key={template.id}
                    to="/r/$name"
                    params={{ name: community.name }}
                    search={{ flair: active ? undefined : template.id }}
                    className={className}
                    style={style}
                  >
                    {children}
                  </Link>
                )}
              />
            }
          />
        </aside>
      </div>

      <Dialog open={welcomeOpen} onOpenChange={setWelcomeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Welcome to r/{community.name}</DialogTitle>
          </DialogHeader>
          <Markdown content={community.welcomeMessage} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
