import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { cn } from "@ui/base/lib/utils"
import { Tabs, TabsList, TabsTrigger } from "@ui/base/ui/tabs"
import { ModmailConversationRow } from "@frontends/dashboard/components/modmail/ModmailConversationRow"
import { ModmailThread } from "@frontends/dashboard/components/modmail/ModmailThread"
import type { ModmailFolder } from "@frontends/dashboard/components/modmail/types"
import {
  getApiV1CommunityByNameOptions,
  getApiV1ModmailCommunityByCommunityIdOptions,
  getApiV1ModmailMineAsModOptions,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { Mail } from "lucide-react"

const FOLDERS: { value: ModmailFolder; label: string }[] = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In Progress" },
  { value: "archived", label: "Archived" },
]
const FOLDER_VALUES = new Set(FOLDERS.map((f) => f.value))
const MODMAIL_LIST_POLL_MS = 15_000

type ModmailSearch = {
  m?: string
  folder: ModmailFolder
}

export const Route = createFileRoute("/mod/$name/modmail")({
  validateSearch: (search: Record<string, unknown>): ModmailSearch => ({
    m: typeof search.m === "string" ? search.m : undefined,
    folder:
      typeof search.folder === "string" && FOLDER_VALUES.has(search.folder as ModmailFolder)
        ? (search.folder as ModmailFolder)
        : "new",
  }),
  component: ModmailModPage,
})

function ModmailModPage() {
  const { name } = Route.useParams()
  const { m: selectedId, folder } = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const aggregate = name === "mod"

  // Resolve the community id for a single-community view.
  const { data: community } = useQuery({
    ...getApiV1CommunityByNameOptions({ path: { name } }),
    enabled: !aggregate,
  })
  const communityId = community?.id

  const aggregateQuery = getApiV1ModmailMineAsModOptions({ query: { folder } })
  const communityQuery = getApiV1ModmailCommunityByCommunityIdOptions({
    path: { communityId: communityId ?? "" },
    query: { folder },
  })

  const aggregateResult = useQuery({
    ...aggregateQuery,
    enabled: aggregate,
    refetchInterval: MODMAIL_LIST_POLL_MS,
    refetchIntervalInBackground: false,
  })
  const communityResult = useQuery({
    ...communityQuery,
    enabled: !aggregate && Boolean(communityId),
    refetchInterval: MODMAIL_LIST_POLL_MS,
    refetchIntervalInBackground: false,
  })

  const { data, isLoading } = aggregate ? aggregateResult : communityResult
  const conversations = data?.data ?? []

  const setSelected = (id: string | undefined) => {
    void navigate({ to: "/mod/$name/modmail", params: { name }, search: { m: id, folder } })
  }
  const setFolder = (next: ModmailFolder) => {
    void navigate({
      to: "/mod/$name/modmail",
      params: { name },
      search: { m: undefined, folder: next },
    })
  }
  const refreshList = () => {
    void queryClient.invalidateQueries({
      queryKey: (aggregate ? aggregateQuery : communityQuery).queryKey,
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Mail className="size-5 text-primary" />
        <h1 className="text-lg font-bold">Mod Mail</h1>
      </div>

      <Tabs
        value={folder}
        onValueChange={(v) => {
          setFolder(v as ModmailFolder)
        }}
      >
        <TabsList>
          {FOLDERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value}>
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

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
              No conversations in this folder.
            </p>
          ) : (
            conversations.map((conversation) => (
              <ModmailConversationRow
                key={conversation.id}
                conversation={conversation}
                selected={conversation.id === selectedId}
                showCommunity={aggregate}
                onSelect={(id) => {
                  setSelected(id)
                }}
              />
            ))
          )}
        </div>
        <div className={cn("min-w-0 flex-1", selectedId ? "block" : "hidden md:block")}>
          {selectedId ? (
            <ModmailThread
              key={selectedId}
              conversationId={selectedId}
              onListChanged={refreshList}
            />
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
