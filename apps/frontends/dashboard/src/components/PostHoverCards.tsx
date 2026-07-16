import { type ReactElement, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@ui/base/ui/button"
import {
  CommunityHoverCard,
  type CommunityHoverCardData,
} from "@ui/seo-shared/community/CommunityHoverCard"
import { UserHoverCard, type UserHoverCardData } from "@ui/seo-shared/community/UserHoverCard"
import { mediaUrl } from "@frontends/dashboard/lib/mediaUrl"
import {
  deleteApiV1UserFollowByUsernameMutation,
  getApiV1CommunityByNameOptions,
  getApiV1CommunityMemberMineOptions,
  getApiV1UserByUsernameByUsernameOptions,
  postApiV1CommunityMemberByCommunityIdJoinMutation,
  putApiV1UserFollowByUsernameMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { toast } from "sonner"

function HoverJoinButton({ communityId, isMember }: { communityId: string; isMember: boolean }) {
  const queryClient = useQueryClient()
  const [joined, setJoined] = useState(isMember)
  const join = useMutation({
    ...postApiV1CommunityMemberByCommunityIdJoinMutation(),
    onSuccess: () => {
      setJoined(true)
      void queryClient.invalidateQueries({
        queryKey: getApiV1CommunityMemberMineOptions().queryKey,
      })
    },
    onError: () => {
      toast.error("Could not join community")
    },
  })
  if (joined) {
    return (
      <Button size="sm" variant="outline" className="h-7 shrink-0 rounded-full px-3" disabled>
        Joined
      </Button>
    )
  }
  return (
    <Button
      size="sm"
      className="h-7 shrink-0 rounded-full px-3"
      disabled={join.isPending}
      onClick={() => {
        join.mutate({ path: { communityId } })
      }}
    >
      Join
    </Button>
  )
}

/**
 * Wraps an r/community link in a reddit-style hover card. Lazily fetches the
 * community by name when the popover first opens; the Join button is functional.
 */
export function CommunityLinkHoverCard({
  name,
  children,
}: {
  name: string
  children: ReactElement
}) {
  const [open, setOpen] = useState(false)
  const query = useQuery({
    ...getApiV1CommunityByNameOptions({ path: { name } }),
    enabled: open,
  })
  const c = query.data
  const data: CommunityHoverCardData | undefined = c
    ? {
        name: c.name,
        displayName: c.displayName,
        description: c.description,
        visibility: c.visibility,
        iconUrl: mediaUrl(c.iconImageKey),
        memberCount: c.memberCount,
        createdAt: c.createdAt,
      }
    : undefined
  return (
    <CommunityHoverCard
      data={data}
      onOpenChange={(next) => {
        if (next) setOpen(true)
      }}
      joinSlot={c ? <HoverJoinButton communityId={c.id} isMember={c.viewer.isMember} /> : undefined}
    >
      {children}
    </CommunityHoverCard>
  )
}

function HoverFollowButton({ username }: { username: string }) {
  const [following, setFollowing] = useState(false)
  const follow = useMutation({
    ...putApiV1UserFollowByUsernameMutation(),
    onError: () => {
      setFollowing(false)
      toast.error("Could not follow user")
    },
  })
  const unfollow = useMutation({
    ...deleteApiV1UserFollowByUsernameMutation(),
    onError: () => {
      setFollowing(true)
      toast.error("Could not unfollow user")
    },
  })
  const pending = follow.isPending || unfollow.isPending
  return (
    <Button
      size="sm"
      variant={following ? "outline" : "default"}
      className="h-7 shrink-0 rounded-full px-3"
      disabled={pending}
      onClick={() => {
        if (following) {
          setFollowing(false)
          unfollow.mutate({ path: { username } })
        } else {
          setFollowing(true)
          follow.mutate({ path: { username } })
        }
      }}
    >
      {following ? "Following" : "Follow"}
    </Button>
  )
}

/**
 * Wraps a u/username link in a reddit-style hover card. Lazily fetches the user
 * by username when the popover first opens; the Follow button is functional.
 */
export function UserLinkHoverCard({
  username,
  children,
}: {
  username: string
  children: ReactElement
}) {
  const [open, setOpen] = useState(false)
  const query = useQuery({
    ...getApiV1UserByUsernameByUsernameOptions({ path: { username } }),
    enabled: open,
  })
  const u = query.data
  const data: UserHoverCardData | undefined = u
    ? {
        username: u.username,
        displayName: u.displayName,
        avatarUrl: mediaUrl(u.avatarImageKey),
        postKarma: u.postKarma,
        commentKarma: u.commentKarma,
        createdAt: u.createdAt,
      }
    : undefined
  return (
    <UserHoverCard
      data={data}
      onOpenChange={(next) => {
        if (next) setOpen(true)
      }}
      followSlot={<HoverFollowButton username={username} />}
    >
      {children}
    </UserHoverCard>
  )
}
