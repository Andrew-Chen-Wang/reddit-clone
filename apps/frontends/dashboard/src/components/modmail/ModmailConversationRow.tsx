import { cn } from "@ui/base/lib/utils"
import { CommunityIcon } from "@ui/seo-shared/community/CommunityIcon"
import { RelativeTime } from "@ui/seo-shared/RelativeTime"
import { mediaUrl } from "@frontends/dashboard/lib/mediaUrl"
import { Star } from "lucide-react"
import type { ModmailConversation } from "@frontends/dashboard/components/modmail/types"

export function ModmailConversationRow({
  conversation,
  selected,
  showCommunity,
  onSelect,
}: {
  conversation: ModmailConversation
  selected: boolean
  showCommunity?: boolean
  onSelect: (id: string) => void
}) {
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
      <div className="flex items-center gap-2">
        {conversation.isHighlighted ? (
          <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" />
        ) : null}
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{conversation.subject}</span>
        <RelativeTime
          date={conversation.lastMessageAt}
          className="shrink-0 text-[11px] text-muted-foreground"
        />
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {showCommunity ? (
          <>
            <CommunityIcon
              name={conversation.communityName}
              iconUrl={mediaUrl(conversation.communityIconImageKey)}
              size="sm"
            />
            <span className="truncate">r/{conversation.communityName}</span>
            <span>·</span>
          </>
        ) : null}
        <span className="truncate">
          {conversation.participantUsername
            ? `u/${conversation.participantUsername}`
            : "Unknown user"}
        </span>
      </div>
    </button>
  )
}
