import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Avatar, AvatarFallback, AvatarImage } from "@ui/base/ui/avatar"
import { Button } from "@ui/base/ui/button"
import { Checkbox } from "@ui/base/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ui/base/ui/dialog"
import { Input } from "@ui/base/ui/input"
import { Label } from "@ui/base/ui/label"
import { LoadingButton } from "@ui/base/ui/loading-button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ui/base/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ui/base/ui/tabs"
import { RelativeTime } from "@ui/seo-shared/RelativeTime"
import {
  MOD_PERMISSIONS,
  permissionSummary,
  type ModPerms,
} from "@frontends/dashboard/components/mod/permissions"
import { useModCommunity } from "@frontends/dashboard/components/mod/useModCommunity"
import { mediaUrl } from "@frontends/dashboard/lib/mediaUrl"
import {
  deleteApiV1ModTeamByCommunityIdModByUserIdMutation,
  deleteApiV1ModUsersByCommunityIdApprovedByUsernameMutation,
  getApiV1CommunityJoinRequestByCommunityIdPendingOptions,
  getApiV1ModTeamByCommunityIdOptions,
  getApiV1ModUsersByCommunityIdApprovedOptions,
  patchApiV1ModTeamByCommunityIdModByUserIdMutation,
  postApiV1CommunityJoinRequestByIdApproveMutation,
  postApiV1CommunityJoinRequestByIdDenyMutation,
  postApiV1ModTeamByCommunityIdInviteMutation,
  postApiV1ModUsersByCommunityIdApprovedMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { Plus, Trash2, UserPlus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

export const Route = createFileRoute("/mod/$name/members")({
  component: MembersPage,
})

const EMPTY_PERMS: ModPerms = {
  permEverything: false,
  permUsers: false,
  permConfig: false,
  permFlair: false,
  permMail: false,
  permPostsComments: false,
  permWiki: false,
}

function UserCell({
  username,
  avatarImageKey,
}: {
  username: string
  avatarImageKey: string | null
}) {
  return (
    <div className="flex items-center gap-2">
      <Avatar className="size-7">
        {avatarImageKey ? <AvatarImage src={mediaUrl(avatarImageKey) ?? undefined} alt="" /> : null}
        <AvatarFallback className="text-[10px]">
          {username.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium">u/{username}</span>
    </div>
  )
}

function PermissionChecklist({
  value,
  onChange,
}: {
  value: ModPerms
  onChange: (next: ModPerms) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      {MOD_PERMISSIONS.map((perm) => (
        <Label
          key={perm.key}
          htmlFor={`perm-${perm.key}`}
          className="flex cursor-pointer items-start gap-2 rounded-md border p-2.5 hover:bg-accent"
        >
          <Checkbox
            id={`perm-${perm.key}`}
            checked={value[perm.key]}
            onCheckedChange={(checked) => {
              const on = checked
              // "Everything" is exclusive; toggling it clears the rest.
              if (perm.key === "permEverything") {
                onChange({ ...EMPTY_PERMS, permEverything: on })
              } else {
                onChange({ ...value, permEverything: false, [perm.key]: on })
              }
            }}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium">{perm.label}</p>
            <p className="text-xs text-muted-foreground">{perm.description}</p>
          </div>
        </Label>
      ))}
    </div>
  )
}

function InviteDialog({ communityId, onDone }: { communityId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState("")
  const [perms, setPerms] = useState<ModPerms>({ ...EMPTY_PERMS, permEverything: true })

  const invite = useMutation({
    ...postApiV1ModTeamByCommunityIdInviteMutation(),
    onSuccess: () => {
      toast.success(`Invited u/${username} to moderate`)
      setOpen(false)
      setUsername("")
      setPerms({ ...EMPTY_PERMS, permEverything: true })
      onDone()
    },
    onError: () => {
      toast.error("Could not send invite")
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        size="sm"
        onClick={() => {
          setOpen(true)
        }}
      >
        <UserPlus className="size-4" />
        Invite moderator
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a moderator</DialogTitle>
          <DialogDescription>
            They&apos;ll get an invite they can accept from their mod tools.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite-username">Username</Label>
          <Input
            id="invite-username"
            value={username}
            placeholder="username"
            onChange={(e) => {
              setUsername(e.target.value)
            }}
          />
        </div>
        <PermissionChecklist value={perms} onChange={setPerms} />
        <DialogFooter>
          <LoadingButton
            loading={invite.isPending}
            disabled={username.trim() === ""}
            onClick={() => {
              invite.mutate({
                path: { communityId },
                body: { username: username.trim(), ...perms },
              })
            }}
          >
            Send invite
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditPermsDialog({
  communityId,
  userId,
  username,
  initial,
  onDone,
}: {
  communityId: string
  userId: string
  username: string
  initial: ModPerms
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [perms, setPerms] = useState<ModPerms>(initial)

  const save = useMutation({
    ...patchApiV1ModTeamByCommunityIdModByUserIdMutation(),
    onSuccess: () => {
      toast.success("Permissions updated")
      setOpen(false)
      onDone()
    },
    onError: () => {
      toast.error("Could not update permissions")
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setPerms(initial)
          setOpen(true)
        }}
      >
        Edit
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit permissions</DialogTitle>
          <DialogDescription>u/{username}</DialogDescription>
        </DialogHeader>
        <PermissionChecklist value={perms} onChange={setPerms} />
        <DialogFooter>
          <LoadingButton
            loading={save.isPending}
            onClick={() => {
              save.mutate({ path: { communityId, userId }, body: perms })
            }}
          >
            Save
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ModeratorsTab({ communityId }: { communityId: string }) {
  const queryClient = useQueryClient()
  const teamOptions = getApiV1ModTeamByCommunityIdOptions({ path: { communityId } })
  const { data } = useQuery(teamOptions)
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: teamOptions.queryKey })
  }

  const removeMod = useMutation({
    ...deleteApiV1ModTeamByCommunityIdModByUserIdMutation(),
    onSuccess: () => {
      toast.success("Moderator removed")
      invalidate()
    },
    onError: () => {
      toast.error("Could not remove moderator")
    },
  })

  const moderators = data?.moderators ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <InviteDialog communityId={communityId} onDone={invalidate} />
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Moderator</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {moderators.map((mod) => (
              <TableRow key={mod.userId}>
                <TableCell>
                  <UserCell username={mod.username} avatarImageKey={mod.avatarImageKey} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {permissionSummary(mod)}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <EditPermsDialog
                      communityId={communityId}
                      userId={mod.userId}
                      username={mod.username}
                      initial={{
                        permEverything: mod.permEverything,
                        permUsers: mod.permUsers,
                        permConfig: mod.permConfig,
                        permFlair: mod.permFlair,
                        permMail: mod.permMail,
                        permPostsComments: mod.permPostsComments,
                        permWiki: mod.permWiki,
                      }}
                      onDone={invalidate}
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove u/${mod.username}`}
                      disabled={removeMod.isPending}
                      onClick={() => {
                        removeMod.mutate({ path: { communityId, userId: mod.userId } })
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Pending invites</h3>
        {(data?.invites ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending invites.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {data?.invites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <UserCell username={invite.username} avatarImageKey={invite.avatarImageKey} />
                <span className="text-xs text-muted-foreground">
                  Invited <RelativeTime date={invite.createdAt} />
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ApprovedTab({ communityId }: { communityId: string }) {
  const queryClient = useQueryClient()
  const [username, setUsername] = useState("")
  const approvedOptions = getApiV1ModUsersByCommunityIdApprovedOptions({ path: { communityId } })
  const { data } = useQuery(approvedOptions)
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: approvedOptions.queryKey })
  }

  const add = useMutation({
    ...postApiV1ModUsersByCommunityIdApprovedMutation(),
    onSuccess: () => {
      toast.success("User approved")
      setUsername("")
      invalidate()
    },
    onError: () => {
      toast.error("Could not approve user")
    },
  })
  const revoke = useMutation({
    ...deleteApiV1ModUsersByCommunityIdApprovedByUsernameMutation(),
    onSuccess: () => {
      toast.success("Approval revoked")
      invalidate()
    },
    onError: () => {
      toast.error("Could not revoke approval")
    },
  })

  const approved = data?.data ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Input
          value={username}
          placeholder="Add user by username"
          className="max-w-xs"
          onChange={(e) => {
            setUsername(e.target.value)
          }}
        />
        <Button
          disabled={username.trim() === "" || add.isPending}
          onClick={() => {
            add.mutate({ path: { communityId }, body: { username: username.trim() } })
          }}
        >
          <Plus className="size-4" />
          Add
        </Button>
      </div>
      {approved.length === 0 ? (
        <p className="text-sm text-muted-foreground">No approved users yet.</p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Approved</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approved.map((u) => (
                <TableRow key={u.userId}>
                  <TableCell>
                    <UserCell username={u.username} avatarImageKey={u.avatarImageKey} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <RelativeTime date={u.createdAt} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={revoke.isPending}
                        onClick={() => {
                          revoke.mutate({ path: { communityId, username: u.username } })
                        }}
                      >
                        Revoke
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function JoinRequestsTab({ communityId }: { communityId: string }) {
  const queryClient = useQueryClient()
  const pendingOptions = getApiV1CommunityJoinRequestByCommunityIdPendingOptions({
    path: { communityId },
  })
  const { data } = useQuery(pendingOptions)
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: pendingOptions.queryKey })
  }

  const approve = useMutation({
    ...postApiV1CommunityJoinRequestByIdApproveMutation(),
    onSuccess: () => {
      toast.success("Request approved")
      invalidate()
    },
    onError: () => {
      toast.error("Could not approve request")
    },
  })
  const deny = useMutation({
    ...postApiV1CommunityJoinRequestByIdDenyMutation(),
    onSuccess: () => {
      toast.success("Request denied")
      invalidate()
    },
    onError: () => {
      toast.error("Could not deny request")
    },
  })

  const requests = data?.data ?? []

  if (requests.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">No pending join requests.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {requests.map((req) => (
        <div key={req.id} className="flex flex-col gap-2 rounded-md border px-3 py-2.5">
          <div className="flex items-center justify-between">
            <UserCell username={req.username} avatarImageKey={req.avatarImageKey} />
            <span className="text-xs text-muted-foreground">
              <RelativeTime date={req.createdAt} />
            </span>
          </div>
          {req.message ? <p className="text-sm text-muted-foreground">{req.message}</p> : null}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={deny.isPending}
              onClick={() => {
                deny.mutate({ path: { id: req.id } })
              }}
            >
              Deny
            </Button>
            <Button
              size="sm"
              disabled={approve.isPending}
              onClick={() => {
                approve.mutate({ path: { id: req.id } })
              }}
            >
              Approve
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

function MembersPage() {
  const { name } = Route.useParams()
  const { communityId, aggregate, isLoading } = useModCommunity(name)

  if (aggregate) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Choose a specific community to manage its members.
      </p>
    )
  }
  if (isLoading || !communityId) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading...</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Mods &amp; Members</h2>
      <Tabs defaultValue="moderators">
        <TabsList className="flex-wrap">
          <TabsTrigger value="moderators">Moderators</TabsTrigger>
          <TabsTrigger value="approved">Approved users</TabsTrigger>
          <TabsTrigger value="requests">Join requests</TabsTrigger>
        </TabsList>
        <TabsContent value="moderators" className="mt-4">
          <ModeratorsTab communityId={communityId} />
        </TabsContent>
        <TabsContent value="approved" className="mt-4">
          <ApprovedTab communityId={communityId} />
        </TabsContent>
        <TabsContent value="requests" className="mt-4">
          <JoinRequestsTab communityId={communityId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
