import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query"
import { Button } from "@ui/base/ui/button"
import { PostRow } from "@ui/seo-shared/post/PostRow"
import { PostFeedSkeleton } from "@ui/seo-shared/post/PostRowSkeleton"
import { PostActionsMenu } from "@frontends/dashboard/components/PostActionsMenu"
import { PostShareMenu } from "@frontends/dashboard/components/PostShareMenu"
import { mediaUrl } from "@frontends/dashboard/lib/mediaUrl"
import type { FeedPost } from "@frontends/dashboard/components/PostFeed"
import type { ViewMode } from "@frontends/dashboard/components/profile/useFeedView"
import { putApiV1PostVoteByPostId } from "@lib/api-client/generated/sdk.gen"
import { useEffect, useRef } from "react"
import { toast } from "sonner"

export type EngagementPostPage = { posts: FeedPost[]; nextCursor: string | null }

export type EngagementPostListProps = {
  queryKey: unknown[]
  fetchPage: (cursor: string | undefined) => Promise<EngagementPostPage>
  permalinkFor: (post: FeedPost) => string
  emptyTitle: string
  emptyDescription: string
  /** Card / compact density; defaults to card. */
  view?: ViewMode
  /** Seed the action menu's toggle state for lists where it is known. */
  menuInitial?: { saved?: boolean; hidden?: boolean }
  /** Which menu actions should drop the post from this list (deletes always do). */
  removeTriggers?: { hide?: boolean; unsave?: boolean; unhide?: boolean }
}

function nextVoteValue(current: number, direction: 1 | -1): 1 | 0 | -1 {
  if (direction === 1) return current === 1 ? 0 : 1
  return current === -1 ? 0 : -1
}

function toDisplayPost(post: FeedPost): FeedPost {
  return post.community
    ? {
        ...post,
        community: { ...post.community, iconImageKey: mediaUrl(post.community.iconImageKey) },
      }
    : post
}

/**
 * Flat, cursor-paginated post list for the profile history tabs (saved, hidden,
 * upvoted, downvoted). Shares the vote / share / action-menu wiring with PostFeed
 * but reads from a caller-supplied fetcher instead of the feed endpoints.
 */
export function EngagementPostList({
  queryKey,
  fetchPage,
  permalinkFor,
  emptyTitle,
  emptyDescription,
  view = "card",
  menuInitial,
  removeTriggers,
}: EngagementPostListProps) {
  const queryClient = useQueryClient()

  const list = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })

  const voteMutation = useMutation({
    mutationFn: (vars: { postId: string; value: 1 | 0 | -1 }) =>
      putApiV1PostVoteByPostId({
        path: { postId: vars.postId },
        body: { value: vars.value },
        throwOnError: true,
      }),
    onError: () => {
      void queryClient.invalidateQueries({ queryKey })
      toast.error("Could not register your vote")
    },
  })

  function vote(post: FeedPost, direction: 1 | -1) {
    const newVote = nextVoteValue(post.userVote, direction)
    queryClient.setQueryData<InfiniteData<EngagementPostPage>>(queryKey, (old) =>
      old
        ? {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              posts: page.posts.map((p) =>
                p.id === post.id
                  ? { ...p, userVote: newVote, score: p.score + (newVote - p.userVote) }
                  : p,
              ),
            })),
          }
        : old,
    )
    voteMutation.mutate({ postId: post.id, value: newVote })
  }

  function removeFromList(postId: string) {
    queryClient.setQueryData<InfiniteData<EngagementPostPage>>(queryKey, (old) =>
      old
        ? {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              posts: page.posts.filter((p) => p.id !== postId),
            })),
          }
        : old,
    )
  }

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

  const posts = list.data?.pages.flatMap((p) => p.posts) ?? []

  if (list.isLoading) return <PostFeedSkeleton variant={view} />
  if (list.isError) {
    return (
      <div className="rounded-lg border bg-card p-10 text-center">
        <p className="text-sm font-medium text-muted-foreground">Could not load posts</p>
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
  if (posts.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-10 text-center">
        <p className="text-sm font-medium text-muted-foreground">{emptyTitle}</p>
        <p className="mt-1 text-xs text-muted-foreground">{emptyDescription}</p>
      </div>
    )
  }

  return (
    <div
      className={view === "compact" ? "overflow-hidden rounded-lg border" : "flex flex-col gap-3"}
    >
      {posts.map((post) => (
        <PostRow
          key={post.id}
          post={toDisplayPost(post)}
          variant={view}
          href={permalinkFor(post)}
          communityHref={post.community ? `/r/${post.community.name}` : undefined}
          authorHref={post.author ? `/user/${post.author.username}` : undefined}
          onUpvote={() => {
            vote(post, 1)
          }}
          onDownvote={() => {
            vote(post, -1)
          }}
          voteDisabled={post.isLocked}
          shareSlot={
            <PostShareMenu
              post={{
                id: post.id,
                title: post.title,
                community: post.community ? { name: post.community.name } : null,
              }}
              permalink={permalinkFor(post)}
            />
          }
          menuSlot={
            <PostActionsMenu
              post={{
                id: post.id,
                type: post.type,
                bodyMd: post.bodyMd,
                isNsfw: post.isNsfw,
                isSpoiler: post.isSpoiler,
                isOc: post.isOc,
                isAuthor: post.isAuthor,
                author: post.author ? { username: post.author.username } : null,
                community: post.community
                  ? { id: post.community.id, name: post.community.name }
                  : null,
                flair: post.flair ? { id: post.flair.id } : null,
              }}
              initialSaved={menuInitial?.saved}
              initialHidden={menuInitial?.hidden}
              onHidden={removeTriggers?.hide ? removeFromList : undefined}
              onUnsaved={removeTriggers?.unsave ? removeFromList : undefined}
              onUnhidden={removeTriggers?.unhide ? removeFromList : undefined}
              onDeleted={removeFromList}
              onEdited={() => {
                void list.refetch()
              }}
            />
          }
        />
      ))}
      {list.isFetchingNextPage ? <PostFeedSkeleton count={2} variant={view} /> : null}
      <div ref={sentinelRef} aria-hidden className="h-px" />
    </div>
  )
}
