import { useInfiniteQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Button } from "@ui/base/ui/button"
import { Card, CardContent } from "@ui/base/ui/card"
import { Skeleton } from "@ui/base/ui/skeleton"
import { formatCompactNumber } from "@ui/seo-shared/format-number"
import { Markdown } from "@ui/seo-shared/Markdown"
import { RelativeTime } from "@ui/seo-shared/RelativeTime"
import { MessageSquare } from "lucide-react"
import { useEffect, useRef } from "react"

export type CommentWithPost = {
  id: string
  bodyMd: string | null
  score: number
  isDeleted: boolean
  createdAt: string | Date
  editedAt: string | Date | null
  post: {
    id: string
    title: string
    community: { id: string; name: string } | null
  }
}

export type CommentWithPostPage = { comments: CommentWithPost[]; nextCursor: string | null }

export type CommentWithPostListProps = {
  queryKey: unknown[]
  fetchPage: (cursor: string | undefined) => Promise<CommentWithPostPage>
  emptyTitle: string
  emptyDescription: string
  /** Compact view tightens spacing to match the feed's compact density. */
  compact?: boolean
}

/**
 * A single "comment with its post context" row: shows what post the comment was
 * left on plus the comment body and score. Exported so the intertwined Overview
 * feed can render comment items identically to the Comments tab.
 */
export function CommentCard({
  comment,
  compact = false,
}: {
  comment: CommentWithPost
  compact?: boolean
}) {
  const community = comment.post.community

  return (
    <Card>
      <CardContent className={compact ? "flex flex-col gap-1.5 py-3" : "flex flex-col gap-2 py-4"}>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <MessageSquare className="size-3.5 shrink-0" />
          <span>commented on</span>
          {community ? (
            <Link
              to="/r/$name/comments/$"
              params={{ name: community.name, _splat: comment.post.id }}
              search={{ comment: comment.id }}
              className="font-medium text-foreground hover:underline"
            >
              {comment.post.title}
            </Link>
          ) : (
            <span className="font-medium text-foreground">{comment.post.title}</span>
          )}
          {community ? (
            <>
              <span aria-hidden>·</span>
              <Link to="/r/$name" params={{ name: community.name }} className="hover:underline">
                r/{community.name}
              </Link>
            </>
          ) : null}
        </div>

        {comment.isDeleted || comment.bodyMd === null ? (
          <p className="text-sm text-muted-foreground italic">[deleted]</p>
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

/** Cursor-paginated list of a user's comments, each linking to the post it belongs to. */
export function CommentWithPostList({
  queryKey,
  fetchPage,
  emptyTitle,
  emptyDescription,
  compact = false,
}: CommentWithPostListProps) {
  const list = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })

  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && list.hasNextPage && !list.isFetchingNextPage) {
          void list.fetchNextPage()
        }
      },
      { rootMargin: "600px" },
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
    }
  }, [list.hasNextPage, list.isFetchingNextPage, list])

  const comments = list.data?.pages.flatMap((p) => p.comments) ?? []

  if (list.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    )
  }
  if (list.isError) {
    return (
      <div className="rounded-lg border bg-card p-10 text-center">
        <p className="text-sm font-medium text-muted-foreground">Could not load comments</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => {
            void list.refetch()
          }}
        >
          Try again
        </Button>
      </div>
    )
  }
  if (comments.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-10 text-center">
        <p className="text-sm font-medium text-muted-foreground">{emptyTitle}</p>
        <p className="mt-1 text-xs text-muted-foreground">{emptyDescription}</p>
      </div>
    )
  }

  return (
    <div className={compact ? "flex flex-col gap-2" : "flex flex-col gap-3"}>
      {comments.map((comment) => (
        <CommentCard key={comment.id} comment={comment} compact={compact} />
      ))}
      {list.isFetchingNextPage ? <Skeleton className="h-24 w-full rounded-lg" /> : null}
      <div ref={sentinelRef} aria-hidden className="h-px" />
    </div>
  )
}
