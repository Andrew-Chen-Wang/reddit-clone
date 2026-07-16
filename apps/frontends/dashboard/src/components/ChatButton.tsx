import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { buttonVariants } from "@ui/base/ui/button"
import { cn } from "@ui/base/lib/utils"
import { getApiV1ChatUnreadCountOptions } from "@lib/api-client/generated/@tanstack/react-query.gen"
import { MessageCircle } from "lucide-react"

/**
 * TopNav entry point for chat. Polls the unread-conversation count every 15s
 * (paused while the tab is hidden) and renders a badge over the icon.
 */
export function ChatButton() {
  const { data } = useQuery({
    ...getApiV1ChatUnreadCountOptions(),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  })

  const count = data?.count ?? 0

  return (
    <Link
      to="/chat"
      search={{ filter: "all" }}
      aria-label={count > 0 ? `Chat, ${count} unread` : "Chat"}
      className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative rounded-full")}
    >
      <MessageCircle className="size-5" />
      {count > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  )
}
