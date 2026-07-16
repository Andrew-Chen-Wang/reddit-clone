import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { Button, buttonVariants } from "@ui/base/ui/button"
import { cn } from "@ui/base/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@ui/base/ui/popover"
import {
  getApiV1NotificationOptions,
  getApiV1NotificationUnreadCountOptions,
  postApiV1NotificationByIdReadMutation,
  postApiV1NotificationReadAllMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { Bell } from "lucide-react"
import { useState } from "react"
import { NotificationRow } from "@frontends/dashboard/components/notifications/NotificationRow"
import {
  destinationFor,
  invalidateNotifications,
  type NotificationItem,
} from "@frontends/dashboard/components/notifications/meta"

/**
 * TopNav notifications entry point. Polls the unread count every 15s (paused
 * while the tab is hidden, mirroring ChatButton) and opens a preview panel of
 * the latest notifications.
 */
export function NotificationBell() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const { data: unread } = useQuery({
    ...getApiV1NotificationUnreadCountOptions(),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  })
  const count = unread?.count ?? 0

  const { data: list } = useQuery({
    ...getApiV1NotificationOptions({ query: { limit: 8 } }),
    enabled: open,
  })
  const notifications = list?.data ?? []

  const markRead = useMutation({
    ...postApiV1NotificationByIdReadMutation(),
    onSuccess: () => {
      invalidateNotifications(queryClient)
    },
  })

  const markAll = useMutation({
    ...postApiV1NotificationReadAllMutation(),
    onSuccess: () => {
      invalidateNotifications(queryClient)
    },
  })

  const handleSelect = (n: NotificationItem) => {
    if (!n.isRead) markRead.mutate({ path: { id: n.id } })
    setOpen(false)
    void navigate({ to: destinationFor(n) })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative rounded-full")}
      >
        <Bell className="size-5" />
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 gap-0 p-0">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={markAll.isPending || count === 0}
            onClick={() => {
              markAll.mutate({})
            }}
          >
            Mark all as read
          </Button>
        </div>
        <div className="max-h-96 overflow-y-auto p-1">
          {notifications.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-muted-foreground">
              You're all caught up.
            </p>
          ) : (
            notifications.map((n) => (
              <NotificationRow
                key={n.id}
                notification={n}
                onSelect={() => {
                  handleSelect(n)
                }}
              />
            ))
          )}
        </div>
        <div className="border-t p-1">
          <Link
            to="/notifications"
            onClick={() => {
              setOpen(false)
            }}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-full")}
          >
            See all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
