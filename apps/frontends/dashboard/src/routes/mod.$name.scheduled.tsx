import { createFileRoute } from "@tanstack/react-router"
import { CalendarClock } from "lucide-react"

export const Route = createFileRoute("/mod/$name/scheduled")({
  component: ScheduledPostsPage,
})

function ScheduledPostsPage() {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <CalendarClock className="size-8 text-muted-foreground/60" />
      <p className="text-sm font-medium">Scheduled posts</p>
      <p className="max-w-sm text-xs text-muted-foreground">
        Schedule recurring posts and events for your community. This is coming soon.
      </p>
    </div>
  )
}
