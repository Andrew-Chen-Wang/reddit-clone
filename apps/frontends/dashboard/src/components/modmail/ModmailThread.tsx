import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Avatar, AvatarFallback, AvatarImage } from "@ui/base/ui/avatar"
import { Button } from "@ui/base/ui/button"
import { cn } from "@ui/base/lib/utils"
import { Label } from "@ui/base/ui/label"
import { Switch } from "@ui/base/ui/switch"
import { Textarea } from "@ui/base/ui/textarea"
import { RelativeTime } from "@ui/seo-shared/RelativeTime"
import { mediaUrl } from "@frontends/dashboard/lib/mediaUrl"
import {
  getApiV1ModmailByIdMessagesOptions,
  postApiV1ModmailByIdArchiveMutation,
  postApiV1ModmailByIdHighlightMutation,
  postApiV1ModmailByIdMessagesMutation,
  postApiV1ModmailByIdUnarchiveMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { Archive, ArchiveRestore, Star } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

const MODMAIL_POLL_MS = 10_000

/**
 * Shared modmail conversation view. Renders the subject, message history
 * (internal notes styled distinctly), and a reply composer. Mods additionally
 * get the internal-note toggle plus archive/highlight controls.
 *
 * `onListChanged` lets the parent refresh its folder list after archive/highlight.
 */
export function ModmailThread({
  conversationId,
  onListChanged,
}: {
  conversationId: string
  onListChanged?: () => void
}) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState("")
  const [isInternalNote, setIsInternalNote] = useState(false)

  const messagesQuery = getApiV1ModmailByIdMessagesOptions({ path: { id: conversationId } })
  const { data, isLoading } = useQuery({
    ...messagesQuery,
    refetchInterval: MODMAIL_POLL_MS,
    refetchIntervalInBackground: false,
  })

  const invalidateThread = () => {
    void queryClient.invalidateQueries({ queryKey: messagesQuery.queryKey })
  }

  const send = useMutation({
    ...postApiV1ModmailByIdMessagesMutation(),
    onSuccess: () => {
      setDraft("")
      setIsInternalNote(false)
      invalidateThread()
    },
    onError: () => {
      toast.error("Could not send reply")
    },
  })

  const archive = useMutation({
    ...postApiV1ModmailByIdArchiveMutation(),
    onSuccess: () => {
      toast.success("Archived")
      invalidateThread()
      onListChanged?.()
    },
    onError: () => {
      toast.error("Could not archive")
    },
  })

  const unarchive = useMutation({
    ...postApiV1ModmailByIdUnarchiveMutation(),
    onSuccess: () => {
      toast.success("Moved to In Progress")
      invalidateThread()
      onListChanged?.()
    },
    onError: () => {
      toast.error("Could not unarchive")
    },
  })

  const highlight = useMutation({
    ...postApiV1ModmailByIdHighlightMutation(),
    onSuccess: () => {
      invalidateThread()
      onListChanged?.()
    },
    onError: () => {
      toast.error("Could not toggle highlight")
    },
  })

  if (isLoading) {
    return <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>
  }
  if (!data) {
    return <p className="p-6 text-center text-sm text-muted-foreground">Conversation not found.</p>
  }

  const isMod = data.isMod
  const isArchived = data.folder === "archived"

  const handleSend = () => {
    const body = draft.trim()
    if (body.length === 0 || send.isPending) return
    send.mutate({
      path: { id: conversationId },
      body: { body, isInternalNote: isMod ? isInternalNote : undefined },
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start gap-2 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold">{data.subject}</h2>
          <p className="text-xs capitalize text-muted-foreground">
            {data.folder.replace("_", " ")}
          </p>
        </div>
        {isMod ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={data.isHighlighted ? "Remove highlight" : "Highlight"}
              onClick={() => {
                highlight.mutate({ path: { id: conversationId } })
              }}
            >
              <Star
                className={cn("size-4", data.isHighlighted && "fill-amber-400 text-amber-400")}
              />
            </Button>
            {isArchived ? (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  unarchive.mutate({ path: { id: conversationId } })
                }}
              >
                <ArchiveRestore className="size-4" />
                Unarchive
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  archive.mutate({ path: { id: conversationId } })
                }}
              >
                <Archive className="size-4" />
                Archive
              </Button>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
        {data.data.map((message) => (
          <div
            key={message.id}
            className={cn(
              "rounded-lg border p-3",
              message.isInternalNote
                ? "border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30"
                : "bg-card",
            )}
          >
            <div className="mb-1 flex items-center gap-2">
              <Avatar className="size-6">
                {message.authorAvatarImageKey ? (
                  <AvatarImage src={mediaUrl(message.authorAvatarImageKey) ?? undefined} alt="" />
                ) : null}
                <AvatarFallback className="text-[10px]">
                  {(message.authorUsername ?? "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">
                {message.authorUsername ? `u/${message.authorUsername}` : "Unknown"}
              </span>
              {message.isInternalNote ? (
                <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                  Internal note
                </span>
              ) : null}
              <RelativeTime
                date={message.createdAt}
                className="ml-auto text-[11px] text-muted-foreground"
              />
            </div>
            <p className="whitespace-pre-wrap break-words text-sm">{message.bodyMd}</p>
          </div>
        ))}
      </div>

      <div className="border-t p-3">
        {isMod ? (
          <Label htmlFor="modmail-internal-note" className="mb-2 flex items-center gap-2 text-sm">
            <Switch
              id="modmail-internal-note"
              checked={isInternalNote}
              onCheckedChange={(v) => {
                setIsInternalNote(v)
              }}
            />
            Internal note (only mods can see this)
          </Label>
        ) : null}
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            placeholder={isInternalNote ? "Add an internal note…" : "Write a reply…"}
            rows={2}
            maxLength={10000}
            className={cn(
              "max-h-40 min-h-9 resize-none",
              isInternalNote && "border-amber-300 focus-visible:ring-amber-400",
            )}
            onChange={(e) => {
              setDraft(e.target.value)
            }}
          />
          <Button disabled={draft.trim().length === 0 || send.isPending} onClick={handleSend}>
            {isInternalNote ? "Add note" : "Reply"}
          </Button>
        </div>
      </div>
    </div>
  )
}
