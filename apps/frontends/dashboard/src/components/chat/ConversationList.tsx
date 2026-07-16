import { useQuery } from "@tanstack/react-query"
import { Avatar, AvatarFallback, AvatarImage } from "@ui/base/ui/avatar"
import { Button } from "@ui/base/ui/button"
import { cn } from "@ui/base/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@ui/base/ui/dropdown-menu"
import { RelativeTime } from "@ui/seo-shared/RelativeTime"
import { mediaUrl } from "@frontends/dashboard/lib/mediaUrl"
import { getApiV1ChatOptions } from "@lib/api-client/generated/@tanstack/react-query.gen"
import { ListFilter, SquarePen, Users } from "lucide-react"
import { ModInviteList } from "@frontends/dashboard/components/chat/ModInviteList"
import { RequestRowActions } from "@frontends/dashboard/components/chat/RequestRowActions"
import {
  conversationTitle,
  peerOf,
  type ChatFilter,
  type Conversation,
} from "@frontends/dashboard/components/chat/types"

const FILTER_OPTIONS: { value: ChatFilter; label: string }[] = [
  { value: "all", label: "All chats" },
  { value: "groups", label: "Group chats" },
  { value: "dms", label: "Direct chats" },
  { value: "requests", label: "Requests" },
  { value: "unread", label: "Unread" },
]

/**
 * The new-chat + filter controls shared between the list header (on the /chat
 * page) and the floating dock's chrome bar.
 */
export function ChatListControls({
  filter,
  onFilterChange,
  onNewChat,
}: {
  filter: ChatFilter
  onFilterChange: (f: ChatFilter) => void
  onNewChat: () => void
}) {
  return (
    <div className="flex items-center gap-0.5">
      <Button variant="ghost" size="icon" aria-label="New chat" onClick={onNewChat}>
        <SquarePen className="size-4" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="Filter conversations">
              <ListFilter className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup
            value={filter}
            onValueChange={(v) => {
              onFilterChange(v as ChatFilter)
            }}
          >
            {FILTER_OPTIONS.map((opt) => (
              <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                {opt.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function previewText(conversation: Conversation): string {
  const last = conversation.lastMessage
  if (!last) return "No messages yet"
  if (last.isDeleted || last.body === null) return "[deleted]"
  return last.body
}

function ConversationRow({
  conversation,
  currentUserId,
  selected,
  showRequestActions,
  onSelect,
}: {
  conversation: Conversation
  currentUserId: string | undefined
  selected: boolean
  showRequestActions: boolean
  onSelect: (id: string) => void
}) {
  const title = conversationTitle(conversation, currentUserId)
  const peer = peerOf(conversation, currentUserId)
  const avatarKey = conversation.isGroup ? null : peer?.avatarImageKey
  const initial = title.replace(/^u\//, "").charAt(0).toUpperCase() || "?"

  return (
    <button
      type="button"
      onClick={() => {
        onSelect(conversation.id)
      }}
      className={cn(
        "flex w-full flex-col gap-1 border-b px-3 py-2.5 text-left transition-colors hover:bg-accent/60",
        selected && "bg-accent",
      )}
    >
      <div className="flex items-center gap-2.5">
        <Avatar className="size-9 shrink-0">
          {avatarKey ? <AvatarImage src={mediaUrl(avatarKey) ?? undefined} alt="" /> : null}
          <AvatarFallback>
            {conversation.isGroup ? <Users className="size-4" /> : initial}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{title}</span>
            {conversation.lastMessage ? (
              <RelativeTime
                date={conversation.lastMessage.createdAt}
                className="ml-auto shrink-0 text-[11px] text-muted-foreground"
              />
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "truncate text-xs text-muted-foreground",
                conversation.unreadCount > 0 && "font-medium text-foreground",
              )}
            >
              {previewText(conversation)}
            </span>
            {conversation.unreadCount > 0 ? (
              <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      {showRequestActions ? (
        <RequestRowActions conversation={conversation} currentUserId={currentUserId} />
      ) : null}
    </button>
  )
}

/**
 * Left pane of the chat surface: header (title, new-chat, filter) plus the
 * conversation list. Polls the list every 15s (paused while the tab is hidden).
 */
export function ConversationList({
  filter,
  onFilterChange,
  selectedId,
  currentUserId,
  onSelect,
  onNewChat,
  showHeader = true,
  showModInvites = true,
}: {
  filter: ChatFilter
  onFilterChange: (f: ChatFilter) => void
  selectedId: string | undefined
  currentUserId: string | undefined
  onSelect: (id: string) => void
  onNewChat: () => void
  showHeader?: boolean
  showModInvites?: boolean
}) {
  const { data, isLoading } = useQuery({
    ...getApiV1ChatOptions({ query: { filter } }),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  })

  const conversations = data?.data ?? []
  const isRequests = filter === "requests"

  return (
    <div className="flex h-full w-full flex-col">
      {showHeader ? (
        <div className="flex items-center gap-1 border-b px-3 py-2.5">
          <h1 className="text-lg font-bold">Chats</h1>
          <div className="ml-auto">
            <ChatListControls
              filter={filter}
              onFilterChange={onFilterChange}
              onNewChat={onNewChat}
            />
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {showModInvites ? <ModInviteList /> : null}
        {isLoading ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {isRequests ? "No message requests." : "No conversations yet."}
            </p>
            {!isRequests ? (
              <Button variant="outline" size="sm" onClick={onNewChat}>
                Start a chat
              </Button>
            ) : null}
          </div>
        ) : (
          conversations.map((conversation) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              currentUserId={currentUserId}
              selected={conversation.id === selectedId}
              showRequestActions={isRequests}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  )
}
