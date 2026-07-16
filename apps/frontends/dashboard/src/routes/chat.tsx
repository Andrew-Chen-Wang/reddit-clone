import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Button } from "@ui/base/ui/button"
import { cn } from "@ui/base/lib/utils"
import { ChatThread } from "@frontends/dashboard/components/chat/ChatThread"
import { ConversationList } from "@frontends/dashboard/components/chat/ConversationList"
import { NewChatDialog } from "@frontends/dashboard/components/chat/NewChatDialog"
import type { ChatFilter } from "@frontends/dashboard/components/chat/types"
import {
  getApiV1ChatOptions,
  getApiV1UserMeOptions,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { ArrowLeft, MessageSquare } from "lucide-react"
import { useState } from "react"

const FILTER_VALUES: ReadonlySet<ChatFilter> = new Set([
  "all",
  "groups",
  "dms",
  "requests",
  "unread",
])

type ChatSearch = {
  c?: string
  filter: ChatFilter
}

export const Route = createFileRoute("/chat")({
  validateSearch: (search: Record<string, unknown>): ChatSearch => ({
    c: typeof search.c === "string" ? search.c : undefined,
    filter:
      typeof search.filter === "string" && FILTER_VALUES.has(search.filter as ChatFilter)
        ? (search.filter as ChatFilter)
        : "all",
  }),
  component: ChatPage,
})

function ChatPage() {
  const { c: selectedId, filter } = Route.useSearch()
  const navigate = useNavigate()
  const [newChatOpen, setNewChatOpen] = useState(false)

  const { data: me } = useQuery(getApiV1UserMeOptions())
  const currentUserId = me?.id

  // Resolve the selected conversation from the full list so the thread has its
  // metadata regardless of the active list filter.
  const { data: allChats } = useQuery({
    ...getApiV1ChatOptions({ query: { filter: "all" } }),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  })
  const selected = allChats?.data.find((conv) => conv.id === selectedId)

  const setSelected = (id: string | undefined) => {
    void navigate({ to: "/chat", search: { c: id, filter }, replace: !selectedId })
  }
  const setFilter = (next: ChatFilter) => {
    void navigate({ to: "/chat", search: { c: selectedId, filter: next } })
  }

  return (
    <div className="flex h-[calc(100svh-3.5rem)] w-full">
      <div
        className={cn("w-full shrink-0 border-r md:w-80", selectedId ? "hidden md:flex" : "flex")}
      >
        <ConversationList
          filter={filter}
          onFilterChange={setFilter}
          selectedId={selectedId}
          currentUserId={currentUserId}
          onSelect={(id) => {
            setSelected(id)
          }}
          onNewChat={() => {
            setNewChatOpen(true)
          }}
        />
      </div>

      <div className={cn("min-w-0 flex-1", selectedId ? "flex" : "hidden md:flex")}>
        {selected ? (
          <div className="flex w-full flex-col">
            <div className="border-b px-2 py-1.5 md:hidden">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setSelected(undefined)
                }}
              >
                <ArrowLeft className="size-4" />
                Chats
              </Button>
            </div>
            <div className="min-h-0 flex-1">
              <ChatThread key={selected.id} conversation={selected} currentUserId={currentUserId} />
            </div>
          </div>
        ) : (
          <div className="flex w-full flex-col items-center justify-center gap-2 text-center">
            <MessageSquare className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Select a conversation or start a new chat.
            </p>
          </div>
        )}
      </div>

      <NewChatDialog
        open={newChatOpen}
        onOpenChange={setNewChatOpen}
        onCreated={(id) => {
          setSelected(id)
        }}
      />
    </div>
  )
}
