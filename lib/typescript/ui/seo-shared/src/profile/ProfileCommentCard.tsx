import { Card, CardContent } from "@ui/base/ui/card"
import { MessageSquare } from "lucide-react"
import { SeoLink } from "@ui/seo-shared/_internal/seo-link"
import { formatCompactNumber } from "@ui/seo-shared/format-number"
import { Markdown } from "@ui/seo-shared/Markdown"
import { RelativeTime } from "@ui/seo-shared/RelativeTime"

export type ProfileCommentCardComment = {
  id: string
  bodyMd: string | null
  score: number
  isDeleted: boolean
  createdAt: string | Date
  editedAt: string | Date | null
  post: {
    title: string
    /** Link to the post (with the comment anchored), or omit to render plain text. */
    href?: string
    community: { name: string; href?: string } | null
  }
}

/**
 * Framework-agnostic "comment with its post context" row used by the anon SSR
 * profile overview. Mirrors the dashboard's CommentCard so the intertwined
 * overview looks identical for logged-in and logged-out visitors.
 */
export function ProfileCommentCard({ comment }: { comment: ProfileCommentCardComment }) {
  const community = comment.post.community
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 py-4">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <MessageSquare className="size-3.5 shrink-0" />
          <span>commented on</span>
          {comment.post.href ? (
            <SeoLink
              href={comment.post.href}
              className="font-medium text-foreground hover:underline"
            >
              {comment.post.title}
            </SeoLink>
          ) : (
            <span className="font-medium text-foreground">{comment.post.title}</span>
          )}
          {community ? (
            <>
              <span aria-hidden>·</span>
              {community.href ? (
                <SeoLink href={community.href} className="hover:underline">
                  r/{community.name}
                </SeoLink>
              ) : (
                <span>r/{community.name}</span>
              )}
            </>
          ) : null}
        </div>

        {comment.isDeleted || comment.bodyMd === null ? (
          <p className="text-sm italic text-muted-foreground">[deleted]</p>
        ) : (
          <Markdown content={comment.bodyMd} />
        )}

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-semibold">{formatCompactNumber(comment.score)} points</span>
          <span aria-hidden>·</span>
          <RelativeTime date={comment.createdAt} />
          {comment.editedAt ? <span className="italic">(edited)</span> : null}
        </div>
      </CardContent>
    </Card>
  )
}
