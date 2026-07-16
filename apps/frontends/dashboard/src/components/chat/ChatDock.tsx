import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Button } from "@ui/base/ui/button"
import { ChatThread } from "@frontends/dashboard/components/chat/ChatThread"
import {
  ChatListControls,
  ConversationList,
} from "@frontends/dashboard/components/chat/ConversationList"
import { useChatDock } from "@frontends/dashboard/components/chat/ChatDockContext"
import { NewChatDialog } from "@frontends/dashboard/components/chat/NewChatDialog"
import { conversationTitle, type ChatFilter } from "@frontends/dashboard/components/chat/types"
import {
  getApiV1ChatOptions,
  getApiV1ChatUnreadCountOptions,
  getApiV1UserMeOptions,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { ArrowLeft, ChevronDown, MessageCircle, SquareArrowOutUpRight, X } from "lucide-react"
import { useState } from "react"

function CollapsedBar({ onOpen }: { onOpen: () => void }) {
  const { data } = useQuery({
    ...getApiV1ChatUnreadCountOptions(),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  })
  const count = data?.count ?? 0

  return (
    <button
      type="button"
      onClick={onOpen}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border bg-background py-2 pl-4 pr-5 shadow-lg transition-colors hover:bg-accent"
    >
      <MessageCircle className="size-5" />
      <span className="text-sm font-semibold">Chats</span>
      {count > 0 ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </button>
  )
}

/**
 * Reddit-style persistent floating chat dock pinned bottom-right. Shares the
 * conversation list + thread components (and their polling) with the full
 * `/chat` page. Controlled by {@link useChatDock}; mount once, globally.
 */
export function ChatDock() {
  const dock = useChatDock()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<ChatFilter>("all")
  const [newChatOpen, setNewChatOpen] = useState(false)

  const { data: me } = useQuery(getApiV1UserMeOptions())
  const currentUserId = me?.id

  const { data: allChats } = useQuery({
    ...getApiV1ChatOptions({ query: { filter: "all" } }),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    enabled: dock.view === "open",
  })
  const selected = allChats?.data.find((conv) => conv.id === dock.selectedId)

  if (dock.view === "hidden") return null
  if (dock.view === "collapsed") return <CollapsedBar onOpen={dock.open} />

  const externalize = () => {
    void navigate({ to: "/chat", search: { c: dock.selectedId, filter } })
    dock.collapse()
  }

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50 flex h-[32rem] max-h-[calc(100svh-2rem)] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
        <div className="flex items-center gap-1 border-b px-2 py-1.5">
          {selected ? (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Back to conversations"
                onClick={dock.clearSelection}
              >
                <ArrowLeft className="size-4" />
              </Button>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {conversationTitle(selected, currentUserId)}
              </span>
            </>
          ) : (
            <>
              <span className="flex-1 pl-1 text-sm font-bold">Chats</span>
              <ChatListControls
                filter={filter}
                onFilterChange={setFilter}
                onNewChat={() => {
                  setNewChatOpen(true)
                }}
              />
            </>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Open full chat page"
            onClick={externalize}
          >
            <SquareArrowOutUpRight className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Minimize chat" onClick={dock.collapse}>
            <ChevronDown className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Close chat" onClick={dock.hide}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1">
          {selected ? (
            <ChatThread key={selected.id} conversation={selected} currentUserId={currentUserId} />
          ) : (
            <ConversationList
              filter={filter}
              onFilterChange={setFilter}
              selectedId={dock.selectedId}
              currentUserId={currentUserId}
              onSelect={dock.openConversation}
              onNewChat={() => {
                setNewChatOpen(true)
              }}
              showHeader={false}
            />
          )}
        </div>
      </div>

      <NewChatDialog
        open={newChatOpen}
        onOpenChange={setNewChatOpen}
        onCreated={dock.openConversation}
      />
    </>
  )
}
