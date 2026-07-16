import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@ui/base/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@ui/base/ui/dialog"
import { Input } from "@ui/base/ui/input"
import { Label } from "@ui/base/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ui/base/ui/tabs"
import { Textarea } from "@ui/base/ui/textarea"
import {
  getApiV1ChatOptions,
  postApiV1ChatDmMutation,
  postApiV1ChatGroupMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { X } from "lucide-react"
import { useState, type KeyboardEvent } from "react"
import { toast } from "sonner"

function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^u\//i, "").replace(/^@/, "")
}

export function NewChatDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (conversationId: string) => void
}) {
  const queryClient = useQueryClient()

  // DM tab state
  const [dmUsername, setDmUsername] = useState("")
  const [dmBody, setDmBody] = useState("")

  // Group tab state
  const [groupName, setGroupName] = useState("")
  const [groupUsernames, setGroupUsernames] = useState<string[]>([])
  const [groupUsernameDraft, setGroupUsernameDraft] = useState("")
  const [groupBody, setGroupBody] = useState("")

  const reset = () => {
    setDmUsername("")
    setDmBody("")
    setGroupName("")
    setGroupUsernames([])
    setGroupUsernameDraft("")
    setGroupBody("")
  }

  const handleOpenChange = (v: boolean) => {
    if (!v) reset()
    onOpenChange(v)
  }

  const invalidateList = () => {
    void queryClient.invalidateQueries({ queryKey: getApiV1ChatOptions().queryKey })
  }

  const createDm = useMutation({
    ...postApiV1ChatDmMutation(),
    onSuccess: (res) => {
      invalidateList()
      handleOpenChange(false)
      onCreated(res.conversationId)
    },
    onError: () => {
      toast.error("Could not start chat", {
        description: "You may not be able to message this user.",
      })
    },
  })

  const createGroup = useMutation({
    ...postApiV1ChatGroupMutation(),
    onSuccess: (res) => {
      invalidateList()
      handleOpenChange(false)
      onCreated(res.conversationId)
    },
    onError: () => {
      toast.error("Could not create group chat")
    },
  })

  const addGroupUsername = () => {
    const name = normalizeUsername(groupUsernameDraft)
    if (name.length === 0) return
    if (!groupUsernames.includes(name)) setGroupUsernames([...groupUsernames, name])
    setGroupUsernameDraft("")
  }

  const onGroupUsernameKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addGroupUsername()
    } else if (
      e.key === "Backspace" &&
      groupUsernameDraft.length === 0 &&
      groupUsernames.length > 0
    ) {
      setGroupUsernames(groupUsernames.slice(0, -1))
    }
  }

  const submitDm = () => {
    const username = normalizeUsername(dmUsername)
    if (username.length === 0 || dmBody.trim().length === 0) return
    createDm.mutate({ body: { username, body: dmBody.trim() } })
  }

  const submitGroup = () => {
    const usernames = [...groupUsernames]
    const draft = normalizeUsername(groupUsernameDraft)
    if (draft.length > 0 && !usernames.includes(draft)) usernames.push(draft)
    if (groupName.trim().length === 0 || usernames.length === 0 || groupBody.trim().length === 0) {
      return
    }
    createGroup.mutate({ body: { name: groupName.trim(), usernames, body: groupBody.trim() } })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New chat</DialogTitle>
          <DialogDescription>Start a direct message or a group conversation.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="dm">
          <TabsList className="w-full">
            <TabsTrigger value="dm">Direct</TabsTrigger>
            <TabsTrigger value="group">Group</TabsTrigger>
          </TabsList>

          <TabsContent value="dm" className="flex flex-col gap-3 pt-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dm-username">Username</Label>
              <Input
                id="dm-username"
                placeholder="username"
                value={dmUsername}
                onChange={(e) => {
                  setDmUsername(e.target.value)
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dm-body">Message</Label>
              <Textarea
                id="dm-body"
                placeholder="Say hello…"
                rows={3}
                maxLength={4000}
                value={dmBody}
                onChange={(e) => {
                  setDmBody(e.target.value)
                }}
              />
            </div>
            <Button
              onClick={submitDm}
              disabled={
                createDm.isPending ||
                normalizeUsername(dmUsername).length === 0 ||
                dmBody.trim().length === 0
              }
            >
              {createDm.isPending ? "Sending…" : "Send message"}
            </Button>
          </TabsContent>

          <TabsContent value="group" className="flex flex-col gap-3 pt-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="group-name">Group name</Label>
              <Input
                id="group-name"
                placeholder="Weekend Plans"
                value={groupName}
                onChange={(e) => {
                  setGroupName(e.target.value)
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="group-usernames">Members</Label>
              {groupUsernames.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {groupUsernames.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-sm"
                    >
                      u/{name}
                      <button
                        type="button"
                        aria-label={`Remove ${name}`}
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setGroupUsernames(groupUsernames.filter((u) => u !== name))
                        }}
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              <Input
                id="group-usernames"
                placeholder="Type a username, press Enter"
                value={groupUsernameDraft}
                onChange={(e) => {
                  setGroupUsernameDraft(e.target.value)
                }}
                onKeyDown={onGroupUsernameKeyDown}
                onBlur={addGroupUsername}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="group-body">Message</Label>
              <Textarea
                id="group-body"
                placeholder="Say hello…"
                rows={3}
                maxLength={4000}
                value={groupBody}
                onChange={(e) => {
                  setGroupBody(e.target.value)
                }}
              />
            </div>
            <Button
              onClick={submitGroup}
              disabled={
                createGroup.isPending ||
                groupName.trim().length === 0 ||
                (groupUsernames.length === 0 &&
                  normalizeUsername(groupUsernameDraft).length === 0) ||
                groupBody.trim().length === 0
              }
            >
              {createGroup.isPending ? "Creating…" : "Create group"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
