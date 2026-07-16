import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@ui/base/ui/button"
import { CommunityIcon } from "@ui/seo-shared/community/CommunityIcon"
import { mediaUrl } from "@frontends/dashboard/lib/mediaUrl"
import {
  getApiV1CommunityMemberModeratedOptions,
  getApiV1ModTeamMyInvitesOptions,
  postApiV1ModTeamInviteByIdAcceptMutation,
  postApiV1ModTeamInviteByIdDeclineMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { ShieldCheck } from "lucide-react"
import { toast } from "sonner"

/**
 * Moderator-invitation section pinned to the top of the chat conversation list
 * (both the /chat page and the floating dock). Reddit surfaces mod invites as a
 * chat-like item with Accept / Decline; we mirror that here in addition to the
 * existing AppSidebar banner.
 */
export function ModInviteList() {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    ...getApiV1ModTeamMyInvitesOptions(),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  })

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
    <div className="border-b bg-muted/30">
      <div className="flex items-center gap-1.5 px-3 pb-1 pt-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <ShieldCheck className="size-3.5" />
        Moderator invitations
      </div>
      {invites.map((invite) => (
        <div key={invite.id} className="flex items-start gap-2.5 px-3 py-2">
          <CommunityIcon
            name={invite.communityName}
            iconUrl={mediaUrl(invite.iconImageKey)}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              <span className="font-semibold">r/{invite.communityName}</span> would like you to
              become a moderator
            </p>
            <div className="mt-1.5 flex gap-1.5">
              <Button
                size="sm"
                disabled={accept.isPending}
                onClick={() => {
                  accept.mutate({ path: { id: invite.id } })
                }}
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={decline.isPending}
                onClick={() => {
                  decline.mutate({ path: { id: invite.id } })
                }}
              >
                Decline
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
