import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Button } from "@ui/base/ui/button"
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
import { RadioGroup, RadioGroupItem } from "@ui/base/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/base/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@ui/base/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ui/base/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ui/base/ui/tabs"
import { Textarea } from "@ui/base/ui/textarea"
import { RelativeTime } from "@ui/seo-shared/RelativeTime"
import { useModCommunity } from "@frontends/dashboard/components/mod/useModCommunity"
import {
  deleteApiV1ModUsersByCommunityIdBanByUsernameMutation,
  deleteApiV1ModUsersByCommunityIdMuteByUsernameMutation,
  deleteApiV1ModUsersNotesByIdMutation,
  getApiV1CommunityRuleByCommunityIdOptions,
  getApiV1ModUsersByCommunityIdNotesByUsernameOptions,
  getApiV1ModUsersByCommunityIdRestrictedOptions,
  postApiV1ModUsersByCommunityIdBanMutation,
  postApiV1ModUsersByCommunityIdMuteMutation,
  postApiV1ModUsersByCommunityIdNotesByUsernameMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { NotebookPen, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

export const Route = createFileRoute("/mod/$name/restricted")({
  component: RestrictedPage,
})

type Rule = { id: string; name: string }
type DayChoice = "3" | "7" | "28" | "perm"

const DAY_CHOICES: { value: DayChoice; label: string }[] = [
  { value: "3", label: "3 days" },
  { value: "7", label: "7 days" },
  { value: "28", label: "28 days" },
  { value: "perm", label: "Permanent" },
]

function daysFromChoice(choice: DayChoice): number | null {
  return choice === "perm" ? null : Number(choice)
}

function expiryLabel(expiresAt: string | Date | null) {
  if (!expiresAt) return "Permanent"
  return <RelativeTime date={expiresAt} />
}

function BanDialog({
  communityId,
  rules,
  onDone,
}: {
  communityId: string
  rules: Rule[]
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState("")
  const [ruleId, setRuleId] = useState("none")
  const [days, setDays] = useState<DayChoice>("perm")
  const [modNote, setModNote] = useState("")
  const [messageToUser, setMessageToUser] = useState("")

  const ban = useMutation({
    ...postApiV1ModUsersByCommunityIdBanMutation(),
    onSuccess: () => {
      toast.success(`Banned u/${username}`)
      setOpen(false)
      setUsername("")
      setRuleId("none")
      setModNote("")
      setMessageToUser("")
      onDone()
    },
    onError: () => {
      toast.error("Could not ban user")
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
        Ban user
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ban a user</DialogTitle>
          <DialogDescription>
            They will no longer be able to post or comment here.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ban-username">Username</Label>
            <Input
              id="ban-username"
              value={username}
              placeholder="username"
              onChange={(e) => {
                setUsername(e.target.value)
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Rule</Label>
            <Select
              items={{
                none: "No specific rule",
                ...Object.fromEntries(rules.map((r) => [r.id, r.name])),
              }}
              value={ruleId}
              onValueChange={(v) => {
                setRuleId(v ?? "none")
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No specific rule</SelectItem>
                {rules.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Duration</Label>
            <RadioGroup
              value={days}
              onValueChange={(v) => {
                setDays(v as DayChoice)
              }}
              className="flex flex-wrap gap-3"
            >
              {DAY_CHOICES.map((c) => (
                <Label
                  key={c.value}
                  htmlFor={`ban-days-${c.value}`}
                  className="flex items-center gap-1.5"
                >
                  <RadioGroupItem id={`ban-days-${c.value}`} value={c.value} />
                  {c.label}
                </Label>
              ))}
            </RadioGroup>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ban-note">Mod note (private)</Label>
            <Textarea
              id="ban-note"
              rows={2}
              value={modNote}
              onChange={(e) => {
                setModNote(e.target.value)
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ban-message">Message to user</Label>
            <Textarea
              id="ban-message"
              rows={2}
              value={messageToUser}
              onChange={(e) => {
                setMessageToUser(e.target.value)
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <LoadingButton
            loading={ban.isPending}
            disabled={username.trim() === ""}
            onClick={() => {
              ban.mutate({
                path: { communityId },
                body: {
                  username: username.trim(),
                  communityRuleId: ruleId === "none" ? null : ruleId,
                  days: daysFromChoice(days),
                  modNote: modNote.trim() === "" ? null : modNote.trim(),
                  messageToUser: messageToUser.trim() === "" ? null : messageToUser.trim(),
                },
              })
            }}
          >
            Ban
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MuteDialog({ communityId, onDone }: { communityId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState("")
  const [days, setDays] = useState<DayChoice>("28")

  const mute = useMutation({
    ...postApiV1ModUsersByCommunityIdMuteMutation(),
    onSuccess: () => {
      toast.success(`Muted u/${username}`)
      setOpen(false)
      setUsername("")
      onDone()
    },
    onError: () => {
      toast.error("Could not mute user")
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setOpen(true)
        }}
      >
        Mute user
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mute a user</DialogTitle>
          <DialogDescription>They won&apos;t be able to send you modmail.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mute-username">Username</Label>
            <Input
              id="mute-username"
              value={username}
              placeholder="username"
              onChange={(e) => {
                setUsername(e.target.value)
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Duration</Label>
            <RadioGroup
              value={days}
              onValueChange={(v) => {
                setDays(v as DayChoice)
              }}
              className="flex flex-wrap gap-3"
            >
              {DAY_CHOICES.map((c) => (
                <Label
                  key={c.value}
                  htmlFor={`mute-days-${c.value}`}
                  className="flex items-center gap-1.5"
                >
                  <RadioGroupItem id={`mute-days-${c.value}`} value={c.value} />
                  {c.label}
                </Label>
              ))}
            </RadioGroup>
          </div>
        </div>
        <DialogFooter>
          <LoadingButton
            loading={mute.isPending}
            disabled={username.trim() === ""}
            onClick={() => {
              mute.mutate({
                path: { communityId },
                body: {
                  username: username.trim(),
                  days: daysFromChoice(days) as 3 | 7 | 28 | null,
                },
              })
            }}
          >
            Mute
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function NotesDrawer({
  communityId,
  username,
  onClose,
}: {
  communityId: string
  username: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState("")
  const notesOptions = getApiV1ModUsersByCommunityIdNotesByUsernameOptions({
    path: { communityId, username },
  })
  const { data } = useQuery(notesOptions)
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: notesOptions.queryKey })
  }

  const add = useMutation({
    ...postApiV1ModUsersByCommunityIdNotesByUsernameMutation(),
    onSuccess: () => {
      setDraft("")
      invalidate()
    },
    onError: () => {
      toast.error("Could not add note")
    },
  })
  const remove = useMutation({
    ...deleteApiV1ModUsersNotesByIdMutation(),
    onSuccess: invalidate,
    onError: () => {
      toast.error("Could not delete note")
    },
  })

  const notes = data?.data ?? []

  return (
    <Sheet
      open
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <SheetContent className="flex w-full flex-col gap-4 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Mod notes</SheetTitle>
          <SheetDescription>u/{username}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-2 px-4">
          <Textarea
            rows={2}
            value={draft}
            placeholder="Add a note about this user"
            onChange={(e) => {
              setDraft(e.target.value)
            }}
          />
          <Button
            size="sm"
            className="w-fit"
            disabled={draft.trim() === "" || add.isPending}
            onClick={() => {
              add.mutate({ path: { communityId, username }, body: { note: draft.trim() } })
            }}
          >
            <Plus className="size-4" />
            Add note
          </Button>
        </div>
        <div className="flex flex-col gap-2 overflow-y-auto px-4">
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="rounded-md border p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm">{note.note}</p>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete note"
                    onClick={() => {
                      remove.mutate({ path: { id: note.id } })
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {note.createdByUsername ? `by u/${note.createdByUsername} · ` : ""}
                  <RelativeTime date={note.createdAt} />
                </p>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function RestrictedPage() {
  const { name } = Route.useParams()
  const { communityId, aggregate, isLoading } = useModCommunity(name)
  const [notesUser, setNotesUser] = useState<string | null>(null)

  if (aggregate) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Choose a specific community to manage restricted users.
      </p>
    )
  }
  if (isLoading || !communityId) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading...</p>
  }

  return (
    <RestrictedInner communityId={communityId} notesUser={notesUser} setNotesUser={setNotesUser} />
  )
}

function RestrictedInner({
  communityId,
  notesUser,
  setNotesUser,
}: {
  communityId: string
  notesUser: string | null
  setNotesUser: (u: string | null) => void
}) {
  const queryClient = useQueryClient()
  const restrictedOptions = getApiV1ModUsersByCommunityIdRestrictedOptions({
    path: { communityId },
  })
  const { data } = useQuery(restrictedOptions)
  const { data: ruleData } = useQuery(
    getApiV1CommunityRuleByCommunityIdOptions({ path: { communityId } }),
  )
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: restrictedOptions.queryKey })
  }

  const unban = useMutation({
    ...deleteApiV1ModUsersByCommunityIdBanByUsernameMutation(),
    onSuccess: () => {
      toast.success("User unbanned")
      invalidate()
    },
    onError: () => {
      toast.error("Could not unban user")
    },
  })
  const unmute = useMutation({
    ...deleteApiV1ModUsersByCommunityIdMuteByUsernameMutation(),
    onSuccess: () => {
      toast.success("User unmuted")
      invalidate()
    },
    onError: () => {
      toast.error("Could not unmute user")
    },
  })

  const rules: Rule[] = ruleData?.data ?? []
  const ruleName = (id: string | null) => rules.find((r) => r.id === id)?.name ?? "—"
  const banned = data?.banned ?? []
  const muted = data?.muted ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Restricted Users</h2>
        <div className="flex gap-2">
          <MuteDialog communityId={communityId} onDone={invalidate} />
          <BanDialog communityId={communityId} rules={rules} onDone={invalidate} />
        </div>
      </div>
      <Tabs defaultValue="banned">
        <TabsList>
          <TabsTrigger value="banned">Banned ({banned.length})</TabsTrigger>
          <TabsTrigger value="muted">Muted ({muted.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="banned" className="mt-4">
          {banned.length === 0 ? (
            <p className="text-sm text-muted-foreground">No banned users.</p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Rule</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {banned.map((u) => (
                    <TableRow key={u.userId}>
                      <TableCell className="font-medium">u/{u.username}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {ruleName(u.communityRuleId)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {expiryLabel(u.expiresAt)}
                      </TableCell>
                      <TableCell className="max-w-40 truncate text-sm text-muted-foreground">
                        {u.modNote ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Mod notes"
                            onClick={() => {
                              setNotesUser(u.username)
                            }}
                          >
                            <NotebookPen className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={unban.isPending}
                            onClick={() => {
                              unban.mutate({ path: { communityId, username: u.username } })
                            }}
                          >
                            Unban
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
        <TabsContent value="muted" className="mt-4">
          {muted.length === 0 ? (
            <p className="text-sm text-muted-foreground">No muted users.</p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {muted.map((u) => (
                    <TableRow key={u.userId}>
                      <TableCell className="font-medium">u/{u.username}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {expiryLabel(u.expiresAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={unmute.isPending}
                            onClick={() => {
                              unmute.mutate({ path: { communityId, username: u.username } })
                            }}
                          >
                            Unmute
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {notesUser ? (
        <NotesDrawer
          communityId={communityId}
          username={notesUser}
          onClose={() => {
            setNotesUser(null)
          }}
        />
      ) : null}
    </div>
  )
}
