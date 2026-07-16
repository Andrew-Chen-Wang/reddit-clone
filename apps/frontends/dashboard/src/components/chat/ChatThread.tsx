import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Avatar, AvatarFallback, AvatarImage } from "@ui/base/ui/avatar"
import { Button } from "@ui/base/ui/button"
import { cn } from "@ui/base/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ui/base/ui/dropdown-menu"
import { Input } from "@ui/base/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@ui/base/ui/popover"
import { Textarea } from "@ui/base/ui/textarea"
import { RelativeTime } from "@ui/seo-shared/RelativeTime"
import { mediaUrl } from "@frontends/dashboard/lib/mediaUrl"
import { getApiV1ChatByConversationIdMessages } from "@lib/api-client/generated/sdk.gen"
import {
  deleteApiV1ChatMessageByMessageIdMutation,
  getApiV1ChatOptions,
  getApiV1ChatUnreadCountOptions,
  patchApiV1ChatByConversationIdMutation,
  postApiV1ChatByConversationIdHideMutation,
  postApiV1ChatByConversationIdLeaveMutation,
  postApiV1ChatByConversationIdMessagesMutation,
  postApiV1ChatByConversationIdReadMutation,
  deleteApiV1ChatByConversationIdParticipantsByUserIdMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { MoreHorizontal, Trash2, Users } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { toast } from "sonner"
import {
  conversationTitle,
  peerOf,
  type ChatMessage,
  type Conversation,
} from "@frontends/dashboard/components/chat/types"

const POLL_MS = 5_000

/** Loads messages for a conversation: initial page, 5s `after` polling, and
 * cursor-based backscroll. Polling pauses while the tab is hidden. */
function useChatMessages(conversationId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [olderCursor, setOlderCursor] = useState<string | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const messagesRef = useRef<ChatMessage[]>([])
  messagesRef.current = messages

  const mergeNewer = useCallback((incoming: ChatMessage[]) => {
    if (incoming.length === 0) return
    setMessages((prev) => {
      const known = new Set(prev.map((m) => m.id))
      const fresh = incoming.filter((m) => !known.has(m.id))
      if (fresh.length === 0) return prev
      return [...prev.filter((m) => !m.id.startsWith("optimistic-")), ...fresh]
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    setInitialLoading(true)
    setMessages([])
    setOlderCursor(null)
    void (async () => {
      try {
        const { data } = await getApiV1ChatByConversationIdMessages({
          path: { conversationId },
          throwOnError: true,
        })
        if (cancelled) return
        setMessages(data.data)
        setOlderCursor(data.nextCursor)
      } catch {
        if (!cancelled) toast.error("Could not load messages")
      } finally {
        if (!cancelled) setInitialLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [conversationId])

  useEffect(() => {
    const poll = () => {
      if (document.hidden) return
      const current = messagesRef.current.filter((m) => !m.id.startsWith("optimistic-"))
      const lastId = current.at(-1)?.id
      if (!lastId) return
      void (async () => {
        try {
          const { data } = await getApiV1ChatByConversationIdMessages({
            path: { conversationId },
            query: { after: lastId },
            throwOnError: true,
          })
          mergeNewer(data.data)
        } catch {
          // transient poll failure; next tick retries
        }
      })()
    }
    const id = setInterval(poll, POLL_MS)
    return () => {
      clearInterval(id)
    }
  }, [conversationId, mergeNewer])

  const loadOlder = useCallback(async () => {
    if (!olderCursor) return
    setLoadingOlder(true)
    try {
      const { data } = await getApiV1ChatByConversationIdMessages({
        path: { conversationId },
        query: { cursor: olderCursor },
        throwOnError: true,
      })
      setMessages((prev) => {
        const known = new Set(prev.map((m) => m.id))
        const older = data.data.filter((m) => !known.has(m.id))
        return [...older, ...prev]
      })
      setOlderCursor(data.nextCursor)
    } catch {
      toast.error("Could not load older messages")
    } finally {
      setLoadingOlder(false)
    }
  }, [conversationId, olderCursor])

  const appendOptimistic = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message])
  }, [])

  const replaceOptimistic = useCallback((tempId: string, real: ChatMessage) => {
    setMessages((prev) => {
      const known = new Set(prev.filter((m) => m.id !== tempId).map((m) => m.id))
      if (known.has(real.id)) return prev.filter((m) => m.id !== tempId)
      return prev.map((m) => (m.id === tempId ? real : m))
    })
  }, [])

  const dropOptimistic = useCallback((tempId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== tempId))
  }, [])

  return {
    messages,
    hasOlder: olderCursor !== null,
    initialLoading,
    loadingOlder,
    loadOlder,
    appendOptimistic,
    replaceOptimistic,
    dropOptimistic,
  }
}

function ParticipantsPopover({
  conversation,
  currentUserId,
  isHost,
}: {
  conversation: Conversation
  currentUserId: string | undefined
  isHost: boolean
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(conversation.name ?? "")

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: getApiV1ChatOptions().queryKey })
  }

  const rename = useMutation({
    ...patchApiV1ChatByConversationIdMutation(),
    onSuccess: () => {
      toast.success("Group renamed")
      invalidate()
    },
    onError: () => {
      toast.error("Could not rename group")
    },
  })

  const kick = useMutation({
    ...deleteApiV1ChatByConversationIdParticipantsByUserIdMutation(),
    onSuccess: () => {
      toast.success("Member removed")
      invalidate()
    },
    onError: () => {
      toast.error("Could not remove member")
    },
  })

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="sm" className="gap-1.5">
            <Users className="size-4" />
            {conversation.participants.length}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-72">
        <PopoverHeader>
          <PopoverTitle>Members</PopoverTitle>
        </PopoverHeader>
        {isHost ? (
          <div className="flex items-center gap-1.5 py-2">
            <Input
              value={name}
              placeholder="Group name"
              onChange={(e) => {
                setName(e.target.value)
              }}
            />
            <Button
              size="sm"
              disabled={rename.isPending || name.trim().length === 0}
              onClick={() => {
                rename.mutate({
                  path: { conversationId: conversation.id },
                  body: { name: name.trim() },
                })
              }}
            >
              Save
            </Button>
          </div>
        ) : null}
        <div className="flex flex-col gap-0.5">
          {conversation.participants.map((p) => (
            <div key={p.userId} className="flex items-center gap-2 rounded-md px-1 py-1">
              <Avatar className="size-6">
                {p.avatarImageKey ? (
                  <AvatarImage src={mediaUrl(p.avatarImageKey) ?? undefined} alt="" />
                ) : null}
                <AvatarFallback className="text-[10px]">
                  {p.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate text-sm">
                {p.displayName ?? `u/${p.username}`}
                {p.role === "host" ? (
                  <span className="ml-1 text-xs text-muted-foreground">· host</span>
                ) : null}
                {p.status === "pending" ? (
                  <span className="ml-1 text-xs text-muted-foreground">· invited</span>
                ) : null}
              </span>
              {isHost && p.userId !== currentUserId ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={kick.isPending}
                  onClick={() => {
                    kick.mutate({
                      path: { conversationId: conversation.id, userId: p.userId },
                    })
                  }}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function MessageBubble({
  message,
  isOwn,
  showSender,
  senderName,
  senderAvatarKey,
  onDelete,
}: {
  message: ChatMessage
  isOwn: boolean
  showSender: boolean
  senderName: string | null
  senderAvatarKey: string | null
  onDelete: (id: string) => void
}) {
  const deleted = message.isDeleted || message.body === null

  return (
    <div className={cn("group flex gap-2", isOwn ? "flex-row-reverse" : "flex-row")}>
      {!isOwn && showSender ? (
        <Avatar className="mt-auto size-6 shrink-0">
          {senderAvatarKey ? (
            <AvatarImage src={mediaUrl(senderAvatarKey) ?? undefined} alt="" />
          ) : null}
          <AvatarFallback className="text-[10px]">
            {(senderName ?? "?").charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ) : !isOwn ? (
        <div className="w-6 shrink-0" />
      ) : null}
      <div className={cn("flex max-w-[75%] flex-col gap-0.5", isOwn ? "items-end" : "items-start")}>
        {!isOwn && showSender && senderName ? (
          <span className="px-1 text-xs text-muted-foreground">{senderName}</span>
        ) : null}
        <div className="flex items-center gap-1.5">
          {isOwn && !deleted ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Message actions"
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => {
                    onDelete(message.id)
                  }}
                >
                  <Trash2 className="size-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          <div
            className={cn(
              "rounded-2xl px-3 py-1.5 text-sm",
              deleted
                ? "bg-muted italic text-muted-foreground"
                : isOwn
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted",
            )}
          >
            {deleted ? (
              "[deleted]"
            ) : (
              <span className="whitespace-pre-wrap break-words">{message.body}</span>
            )}
          </div>
        </div>
        <RelativeTime
          date={message.createdAt}
          className="px-1 text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
        />
      </div>
    </div>
  )
}

/** Right pane: thread header, message list with backscroll + auto-scroll, and
 * the composer. Marks the conversation read on focus and on new inbound messages. */
export function ChatThread({
  conversation,
  currentUserId,
}: {
  conversation: Conversation
  currentUserId: string | undefined
}) {
  const queryClient = useQueryClient()
  const conversationId = conversation.id
  const {
    messages,
    hasOlder,
    initialLoading,
    loadingOlder,
    loadOlder,
    appendOptimistic,
    replaceOptimistic,
    dropOptimistic,
  } = useChatMessages(conversationId)

  const [draft, setDraft] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const tempCounter = useRef(0)
  const lastReadId = useRef<string | null>(null)

  const isHost = conversation.myRole === "host"

  const participantById = useMemo(() => {
    const map = new Map<string, Conversation["participants"][number]>()
    for (const p of conversation.participants) map.set(p.userId, p)
    return map
  }, [conversation.participants])

  const markRead = useMutation({
    ...postApiV1ChatByConversationIdReadMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: getApiV1ChatOptions().queryKey })
      void queryClient.invalidateQueries({ queryKey: getApiV1ChatUnreadCountOptions().queryKey })
    },
  })
  const markReadMutate = markRead.mutate

  const sendMessage = useMutation({
    ...postApiV1ChatByConversationIdMessagesMutation(),
  })

  const deleteMessage = useMutation({
    ...deleteApiV1ChatMessageByMessageIdMutation(),
    onError: () => {
      toast.error("Could not delete message")
    },
  })

  const leave = useMutation({
    ...postApiV1ChatByConversationIdLeaveMutation(),
    onSuccess: () => {
      toast.success("Left conversation")
      void queryClient.invalidateQueries({ queryKey: getApiV1ChatOptions().queryKey })
    },
    onError: () => {
      toast.error("Could not leave conversation")
    },
  })

  const hide = useMutation({
    ...postApiV1ChatByConversationIdHideMutation(),
    onSuccess: () => {
      toast.success("Conversation hidden")
      void queryClient.invalidateQueries({ queryKey: getApiV1ChatOptions().queryKey })
    },
    onError: () => {
      toast.error("Could not hide conversation")
    },
  })

  // Auto-scroll to bottom when the newest message id changes.
  const lastMessageId = messages.at(-1)?.id
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" })
  }, [lastMessageId, conversationId])

  // Mark read on load and whenever a new inbound message arrives while visible.
  useEffect(() => {
    if (!lastMessageId) return
    if (document.hidden) return
    if (lastReadId.current === lastMessageId) return
    lastReadId.current = lastMessageId
    markReadMutate({ path: { conversationId } })
  }, [lastMessageId, conversationId, markReadMutate])

  const handleSend = () => {
    const body = draft.trim()
    if (body.length === 0 || sendMessage.isPending) return
    tempCounter.current += 1
    const tempId = `optimistic-${tempCounter.current}`
    appendOptimistic({
      id: tempId,
      conversationId,
      senderUserId: currentUserId ?? null,
      body,
      isDeleted: false,
      createdAt: new Date(),
    })
    setDraft("")
    sendMessage.mutate(
      { path: { conversationId }, body: { body } },
      {
        onSuccess: (real) => {
          replaceOptimistic(tempId, real)
          void queryClient.invalidateQueries({ queryKey: getApiV1ChatOptions().queryKey })
        },
        onError: () => {
          dropOptimistic(tempId)
          setDraft(body)
          toast.error("Message not sent")
        },
      },
    )
  }

  const onComposerKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleDelete = (id: string) => {
    deleteMessage.mutate(
      { path: { messageId: id } },
      {
        onSuccess: () => {
          markReadMutate({ path: { conversationId } })
        },
      },
    )
  }

  const title = conversationTitle(conversation, currentUserId)
  const peer = peerOf(conversation, currentUserId)
  const headerAvatarKey = conversation.isGroup ? null : peer?.avatarImageKey

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center gap-2.5 border-b px-4 py-2.5">
        <Avatar className="size-8 shrink-0">
          {headerAvatarKey ? (
            <AvatarImage src={mediaUrl(headerAvatarKey) ?? undefined} alt="" />
          ) : null}
          <AvatarFallback>
            {conversation.isGroup ? (
              <Users className="size-4" />
            ) : (
              title.replace(/^u\//, "").charAt(0).toUpperCase()
            )}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title}</p>
          {conversation.isGroup ? (
            <p className="truncate text-xs text-muted-foreground">
              {conversation.participants.length} members
            </p>
          ) : null}
        </div>
        {conversation.isGroup ? (
          <ParticipantsPopover
            conversation={conversation}
            currentUserId={currentUserId}
            isHost={isHost}
          />
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" aria-label="Conversation actions">
                <MoreHorizontal className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            {conversation.isGroup ? (
              <DropdownMenuItem
                onClick={() => {
                  leave.mutate({ path: { conversationId } })
                }}
              >
                Leave group
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              onClick={() => {
                hide.mutate({ path: { conversationId } })
              }}
            >
              Hide conversation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-3">
        {hasOlder ? (
          <div className="flex justify-center pb-1">
            <Button
              variant="outline"
              size="sm"
              disabled={loadingOlder}
              onClick={() => {
                void loadOlder()
              }}
            >
              {loadingOlder ? "Loading…" : "Load older messages"}
            </Button>
          </div>
        ) : null}
        {initialLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No messages yet.</p>
        ) : (
          messages.map((message, i) => {
            const isOwn = message.senderUserId === currentUserId
            const prev = messages[i - 1]
            const showSender =
              conversation.isGroup &&
              !isOwn &&
              (!prev || prev.senderUserId !== message.senderUserId)
            const sender = message.senderUserId
              ? participantById.get(message.senderUserId)
              : undefined
            return (
              <MessageBubble
                key={message.id}
                message={message}
                isOwn={isOwn}
                showSender={showSender}
                senderName={sender ? (sender.displayName ?? `u/${sender.username}`) : null}
                senderAvatarKey={sender?.avatarImageKey ?? null}
                onDelete={handleDelete}
              />
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            placeholder="Message…"
            rows={1}
            maxLength={4000}
            className="max-h-32 min-h-9 resize-none"
            onChange={(e) => {
              setDraft(e.target.value)
            }}
            onKeyDown={onComposerKeyDown}
          />
          <Button
            disabled={draft.trim().length === 0 || sendMessage.isPending}
            onClick={handleSend}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}
