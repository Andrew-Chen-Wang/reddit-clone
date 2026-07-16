import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { cn } from "@ui/base/lib/utils"
import { ModmailConversationRow } from "@frontends/dashboard/components/modmail/ModmailConversationRow"
import { ModmailThread } from "@frontends/dashboard/components/modmail/ModmailThread"
import { getApiV1ModmailMineOptions } from "@lib/api-client/generated/@tanstack/react-query.gen"
import { Mail } from "lucide-react"

const MODMAIL_LIST_POLL_MS = 15_000

type ModmailMineSearch = {
  m?: string
}

export const Route = createFileRoute("/modmail-mine")({
  validateSearch: (search: Record<string, unknown>): ModmailMineSearch => ({
    m: typeof search.m === "string" ? search.m : undefined,
  }),
  component: ModmailMinePage,
})

function ModmailMinePage() {
  const { m: selectedId } = Route.useSearch()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    ...getApiV1ModmailMineOptions(),
    refetchInterval: MODMAIL_LIST_POLL_MS,
    refetchIntervalInBackground: false,
  })
  const conversations = data?.data ?? []

  const setSelected = (id: string | undefined) => {
    void navigate({ to: "/modmail-mine", search: { m: id } })
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-6">
      <div className="flex items-center gap-2">
        <Mail className="size-5 text-primary" />
        <h1 className="text-lg font-bold">Your mod mail</h1>
      </div>

      <div className="flex min-h-[60vh] overflow-hidden rounded-lg border">
        <div
          className={cn(
            "w-full shrink-0 border-r md:w-80",
            selectedId ? "hidden md:block" : "block",
          )}
        >
          {isLoading ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : conversations.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              You haven&apos;t messaged any mods yet.
            </p>
          ) : (
            conversations.map((conversation) => (
              <ModmailConversationRow
                key={conversation.id}
                conversation={conversation}
                selected={conversation.id === selectedId}
                showCommunity
                onSelect={(id) => {
                  setSelected(id)
                }}
              />
            ))
          )}
        </div>
        <div className={cn("min-w-0 flex-1", selectedId ? "block" : "hidden md:block")}>
          {selectedId ? (
            <ModmailThread key={selectedId} conversationId={selectedId} />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
              Select a conversation to read and reply.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
