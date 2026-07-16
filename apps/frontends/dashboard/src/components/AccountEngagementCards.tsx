import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Avatar, AvatarFallback, AvatarImage } from "@ui/base/ui/avatar"
import { Button } from "@ui/base/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@ui/base/ui/card"
import { CommunityIcon } from "@ui/seo-shared/community/CommunityIcon"
import { RelativeTime } from "@ui/seo-shared/RelativeTime"
import { mediaUrl } from "@frontends/dashboard/lib/mediaUrl"
import {
  deleteApiV1MutedCommunityByCommunityIdMutation,
  deleteApiV1ScheduledPostByIdMutation,
  deleteApiV1UserBlockByUsernameMutation,
  getApiV1MutedCommunityMineOptions,
  getApiV1ScheduledPostMineOptions,
  getApiV1UserBlockMineOptions,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { toast } from "sonner"

function BlockedAccountsCard() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery(getApiV1UserBlockMineOptions())
  const unblock = useMutation({
    ...deleteApiV1UserBlockByUsernameMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: getApiV1UserBlockMineOptions().queryKey })
      toast.success("Account unblocked")
    },
    onError: () => {
      toast.error("Could not unblock account")
    },
  })

  const blocked = data?.data ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Blocked accounts</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : blocked.length === 0 ? (
          <p className="text-sm text-muted-foreground">You haven't blocked anyone.</p>
        ) : (
          blocked.map((user) => (
            <div key={user.id} className="flex items-center gap-3">
              <Avatar className="size-8">
                {user.avatarImageKey ? (
                  <AvatarImage src={mediaUrl(user.avatarImageKey) ?? undefined} alt="" />
                ) : null}
                <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {user.displayName ?? `u/${user.username}`}
                </p>
                <p className="truncate text-xs text-muted-foreground">u/{user.username}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={unblock.isPending}
                onClick={() => {
                  unblock.mutate({ path: { username: user.username } })
                }}
              >
                Unblock
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function MutedCommunitiesCard() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery(getApiV1MutedCommunityMineOptions())
  const unmute = useMutation({
    ...deleteApiV1MutedCommunityByCommunityIdMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: getApiV1MutedCommunityMineOptions().queryKey })
      toast.success("Community unmuted")
    },
    onError: () => {
      toast.error("Could not unmute community")
    },
  })

  const muted = data?.data ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Muted communities</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : muted.length === 0 ? (
          <p className="text-sm text-muted-foreground">You haven't muted any communities.</p>
        ) : (
          muted.map((community) => (
            <div key={community.id} className="flex items-center gap-3">
              <CommunityIcon
                name={community.name}
                iconUrl={mediaUrl(community.iconImageKey)}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {community.displayName ?? `r/${community.name}`}
                </p>
                <p className="truncate text-xs text-muted-foreground">r/{community.name}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={unmute.isPending}
                onClick={() => {
                  unmute.mutate({ path: { communityId: community.id } })
                }}
              >
                Unmute
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function ScheduledPostsCard() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery(getApiV1ScheduledPostMineOptions())
  const cancel = useMutation({
    ...deleteApiV1ScheduledPostByIdMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: getApiV1ScheduledPostMineOptions().queryKey })
      toast.success("Scheduled post canceled")
    },
    onError: () => {
      toast.error("Could not cancel scheduled post")
    },
  })

  const scheduled = data?.data ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scheduled posts</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : scheduled.length === 0 ? (
          <p className="text-sm text-muted-foreground">You have no scheduled posts.</p>
        ) : (
          scheduled.map((post) => (
            <div key={post.id} className="flex items-center gap-3 rounded-md border p-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{post.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {post.status === "pending" ? "Scheduled for " : `${post.status} · `}
                  <RelativeTime date={post.scheduledAt} />
                  {post.recurrence ? ` · repeats ${post.recurrence}` : ""}
                </p>
              </div>
              {post.status === "pending" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={cancel.isPending}
                  onClick={() => {
                    cancel.mutate({ path: { id: post.id } })
                  }}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

/** Engagement-related account cards: blocked accounts, muted communities, scheduled posts. */
export function AccountEngagementCards() {
  return (
    <>
      <BlockedAccountsCard />
      <MutedCommunitiesCard />
      <ScheduledPostsCard />
    </>
  )
}
