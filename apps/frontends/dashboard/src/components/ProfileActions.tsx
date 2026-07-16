import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@ui/base/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ui/base/ui/dropdown-menu"
import {
  getApiV1UserBlockMineOptions,
  getApiV1UserFollowMineOptions,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import {
  deleteApiV1UserBlockByUsername,
  deleteApiV1UserFollowByUsername,
  putApiV1UserBlockByUsername,
  putApiV1UserFollowByUsername,
} from "@lib/api-client/generated/sdk.gen"
import { MoreHorizontal, UserX } from "lucide-react"
import { toast } from "sonner"

export type ProfileActionsProps = {
  username: string
}

/** Follow button + overflow (block/unblock) shown on another user's profile. */
export function ProfileActions({ username }: ProfileActionsProps) {
  const queryClient = useQueryClient()
  const { data: follows } = useQuery(getApiV1UserFollowMineOptions())
  const { data: blocks } = useQuery(getApiV1UserBlockMineOptions())

  const lower = username.toLowerCase()
  const isFollowing = (follows?.data ?? []).some((u) => u.username.toLowerCase() === lower)
  const isBlocked = (blocks?.data ?? []).some((u) => u.username.toLowerCase() === lower)

  const followMutation = useMutation({
    mutationFn: (next: boolean) =>
      next
        ? putApiV1UserFollowByUsername({ path: { username }, throwOnError: true })
        : deleteApiV1UserFollowByUsername({ path: { username }, throwOnError: true }),
    onSuccess: (_data, next) => {
      void queryClient.invalidateQueries({ queryKey: getApiV1UserFollowMineOptions().queryKey })
      toast.success(next ? `Following u/${username}` : `Unfollowed u/${username}`)
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } }).response?.status
      toast.error(
        status === 403 ? `u/${username} doesn't allow followers` : "Could not update following",
      )
    },
  })

  const blockMutation = useMutation({
    mutationFn: (next: boolean) =>
      next
        ? putApiV1UserBlockByUsername({ path: { username }, throwOnError: true })
        : deleteApiV1UserBlockByUsername({ path: { username }, throwOnError: true }),
    onSuccess: (_data, next) => {
      void queryClient.invalidateQueries({ queryKey: getApiV1UserBlockMineOptions().queryKey })
      toast.success(next ? `Blocked u/${username}` : `Unblocked u/${username}`)
    },
    onError: () => {
      toast.error("Could not update blocked accounts")
    },
  })

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={isFollowing ? "outline" : "default"}
        size="sm"
        disabled={followMutation.isPending}
        onClick={() => {
          followMutation.mutate(!isFollowing)
        }}
      >
        {isFollowing ? "Following" : "Follow"}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="More profile actions"
          className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant={isBlocked ? "default" : "destructive"}
            disabled={blockMutation.isPending}
            onClick={() => {
              blockMutation.mutate(!isBlocked)
            }}
          >
            <UserX className="size-4" />
            {isBlocked ? "Unblock" : "Block"} u/{username}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
