import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Badge } from "@ui/base/ui/badge"
import { Button } from "@ui/base/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@ui/base/ui/dialog"
import { Input } from "@ui/base/ui/input"
import { Label } from "@ui/base/ui/label"
import { LoadingButton } from "@ui/base/ui/loading-button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ui/base/ui/table"
import { Textarea } from "@ui/base/ui/textarea"
import {
  getApiAdminUsersOptions,
  getApiAdminUsersQueryKey,
  postApiAdminUsersByIdSuspendMutation,
  postApiAdminUsersByIdUnsuspendMutation,
} from "@frontends/admin/lib/adminApi"
import { useState } from "react"
import { toast } from "sonner"

export const Route = createFileRoute("/users")({
  component: UsersPage,
})

interface SuspendTarget {
  id: string
  username: string
}

function UsersPage() {
  const queryClient = useQueryClient()
  const [input, setInput] = useState("")
  const [q, setQ] = useState("")
  const [suspendTarget, setSuspendTarget] = useState<SuspendTarget | null>(null)
  const [reason, setReason] = useState("")

  const listOptions = getApiAdminUsersOptions({ query: q ? { q } : {} })
  const { data, isLoading } = useQuery(listOptions)

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: getApiAdminUsersQueryKey() })
  }

  const suspendMutation = useMutation({
    ...postApiAdminUsersByIdSuspendMutation(),
    onSuccess: () => {
      toast.success("User suspended")
      setSuspendTarget(null)
      setReason("")
      invalidate()
    },
    onError: () => toast.error("Could not suspend user"),
  })

  const unsuspendMutation = useMutation({
    ...postApiAdminUsersByIdUnsuspendMutation(),
    onSuccess: () => {
      toast.success("Suspension lifted")
      invalidate()
    },
    onError: () => toast.error("Could not lift suspension"),
  })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Users</h1>
      </div>

      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setQ(input.trim())
        }}
      >
        <Input
          placeholder="Search by username or email"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
          }}
          className="max-w-sm"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Karma</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : !data || data.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              data.data.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">u/{user.username}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>{(user.postKarma + user.commentKarma).toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {user.suspendedAt ? (
                      <Badge variant="destructive">Suspended</Badge>
                    ) : (
                      <Badge variant="secondary">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {user.suspendedAt ? (
                      <LoadingButton
                        variant="outline"
                        size="sm"
                        loading={
                          unsuspendMutation.isPending &&
                          unsuspendMutation.variables?.path?.id === user.id
                        }
                        onClick={() => {
                          unsuspendMutation.mutate({ path: { id: user.id } })
                        }}
                      >
                        Unsuspend
                      </LoadingButton>
                    ) : (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setSuspendTarget({ id: user.id, username: user.username })
                        }}
                      >
                        Suspend
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={suspendTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSuspendTarget(null)
            setReason("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend u/{suspendTarget?.username}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
              }}
              placeholder="Why is this account being suspended?"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSuspendTarget(null)
              }}
            >
              Cancel
            </Button>
            <LoadingButton
              variant="destructive"
              loading={suspendMutation.isPending}
              onClick={() => {
                if (!suspendTarget) return
                suspendMutation.mutate({
                  path: { id: suspendTarget.id },
                  body: { reason: reason.trim() ? reason.trim() : null },
                })
              }}
            >
              Suspend
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
