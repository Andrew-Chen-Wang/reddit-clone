import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Button, buttonVariants } from "@ui/base/ui/button"
import { cn } from "@ui/base/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ui/base/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@ui/base/ui/tabs"
import {
  getApiV1NotificationInfiniteQueryKey,
  postApiV1NotificationByIdArchiveMutation,
  postApiV1NotificationByIdReadMutation,
  postApiV1NotificationReadAllMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { getApiV1Notification } from "@lib/api-client/generated/sdk.gen"
import { MoreHorizontal } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { NotificationRow } from "@frontends/dashboard/components/notifications/NotificationRow"
import {
  destinationFor,
  invalidateNotifications,
  type NotificationItem,
} from "@frontends/dashboard/components/notifications/meta"

export const Route = createFileRoute("/notifications")({
  component: NotificationsPage,
})

type FilterValue = "all" | "unread"

function NotificationsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<FilterValue>("all")

  const query = useInfiniteQuery({
    queryKey: getApiV1NotificationInfiniteQueryKey({ query: { limit: 20 } }),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data } = await getApiV1Notification({
        query: { limit: 20, cursor: pageParam },
        throwOnError: true,
      })
      return data
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })

  const markRead = useMutation({
    ...postApiV1NotificationByIdReadMutation(),
    onSuccess: () => {
      invalidateNotifications(queryClient)
    },
    onError: () => {
      toast.error("Could not mark as read")
    },
  })

  const markAll = useMutation({
    ...postApiV1NotificationReadAllMutation(),
    onSuccess: () => {
      invalidateNotifications(queryClient)
    },
    onError: () => {
      toast.error("Could not mark all as read")
    },
  })

  const archive = useMutation({
    ...postApiV1NotificationByIdArchiveMutation(),
    onSuccess: () => {
      invalidateNotifications(queryClient)
    },
    onError: () => {
      toast.error("Could not archive notification")
    },
  })

  const all = query.data?.pages.flatMap((p) => p.data) ?? []
  // Client-side filtering across already-loaded pages. Unread is derived from
  // the loaded set, so "Unread" may under-count until more pages are loaded.
  const notifications = filter === "unread" ? all.filter((n) => !n.isRead) : all
  const hasUnread = all.some((n) => !n.isRead)

  const handleSelect = (n: NotificationItem) => {
    if (!n.isRead) markRead.mutate({ path: { id: n.id } })
    void navigate({ to: destinationFor(n) })
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <Button
          variant="outline"
          size="sm"
          disabled={markAll.isPending || !hasUnread}
          onClick={() => {
            markAll.mutate({})
          }}
        >
          Mark all as read
        </Button>
      </div>

      <Tabs
        value={filter}
        onValueChange={(v) => {
          setFilter(v as FilterValue)
        }}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread</TabsTrigger>
        </TabsList>
      </Tabs>

      {query.isLoading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Loading...</p>
      ) : notifications.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          {filter === "unread" ? "No unread notifications." : "You have no notifications yet."}
        </p>
      ) : (
        <div className="flex flex-col divide-y rounded-lg border">
          {notifications.map((n) => (
            <NotificationRow
              key={n.id}
              notification={n}
              onSelect={() => {
                handleSelect(n)
              }}
              trailing={
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label="Notification actions"
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "icon" }),
                      "size-8 rounded-full",
                    )}
                  >
                    <MoreHorizontal className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={n.isRead}
                      onClick={() => {
                        markRead.mutate({ path: { id: n.id } })
                      }}
                    >
                      Mark as read
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        archive.mutate({ path: { id: n.id } })
                      }}
                    >
                      Archive
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              }
            />
          ))}
        </div>
      )}

      {query.hasNextPage ? (
        <div className="mt-4 text-center">
          <Button
            variant="outline"
            size="sm"
            disabled={query.isFetchingNextPage}
            onClick={() => {
              void query.fetchNextPage()
            }}
          >
            {query.isFetchingNextPage ? "Loading..." : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
