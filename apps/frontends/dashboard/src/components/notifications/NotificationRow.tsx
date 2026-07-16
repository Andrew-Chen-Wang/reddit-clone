import { cn } from "@ui/base/lib/utils"
import { RelativeTime } from "@ui/seo-shared/RelativeTime"
import type { ReactNode } from "react"
import { describeNotification, iconFor, snippetFor, type NotificationItem } from "./meta"

/**
 * Presentational notification row shared by the bell dropdown and the full
 * notifications page. The main content is a button (marks read + navigates);
 * an optional `trailing` slot holds a per-row actions menu that must not
 * trigger the row click.
 */
export function NotificationRow({
  notification,
  onSelect,
  trailing,
}: {
  notification: NotificationItem
  onSelect: () => void
  trailing?: ReactNode
}) {
  const Icon = iconFor(notification.type)
  const headline = describeNotification(notification)
  const snippet = snippetFor(notification)

  return (
    <div
      className={cn(
        "relative flex items-start gap-2 rounded-md pr-1 transition-colors hover:bg-accent/60",
        !notification.isRead && "bg-primary/5",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-start gap-3 px-3 py-2.5 text-left"
      >
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-1.5">
            {!notification.isRead ? (
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
            ) : null}
            <span className="line-clamp-2 text-sm font-medium">{headline}</span>
          </span>
          {snippet ? (
            <span className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{snippet}</span>
          ) : null}
          <RelativeTime
            date={notification.createdAt}
            className="mt-0.5 block text-xs text-muted-foreground"
          />
        </span>
      </button>
      {trailing ? <div className="shrink-0 self-center">{trailing}</div> : null}
    </div>
  )
}
