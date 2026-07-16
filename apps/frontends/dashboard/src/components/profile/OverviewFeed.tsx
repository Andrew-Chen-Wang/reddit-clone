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
import {
  CommunityLinkHoverCard,
  UserLinkHoverCard,
} from "@frontends/dashboard/components/PostHoverCards"
import {
  CommentCard,
  type CommentWithPost,
} from "@frontends/dashboard/components/CommentWithPostList"
import type { FeedPost } from "@frontends/dashboard/components/PostFeed"
import { mediaUrl } from "@frontends/dashboard/lib/mediaUrl"
import {
  getApiV1UserByUsernameByUsernameOverview,
  putApiV1PostVoteByPostId,
} from "@lib/api-client/generated/sdk.gen"
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from "react"
import { toast } from "sonner"
import { FeedViewMenu } from "./FeedViewMenu"
import { OverviewFilterMenu, type OverviewFilter } from "./OverviewFilterMenu"
import { useFeedView } from "./useFeedView"

function wrapCommunityLink(link: ReactElement, name: string): ReactNode {
  return <CommunityLinkHoverCard name={name}>{link}</CommunityLinkHoverCard>
}

function wrapAuthorLink(link: ReactElement, uname: string): ReactNode {
  return <UserLinkHoverCard username={uname}>{link}</UserLinkHoverCard>
}

/**
 * An Overview item is a discriminated union: either one of the user's posts or
 * one of their comments (rendered with its post context). Matches the shape of
 * GET /v1/user/:username/overview.
 */
export type OverviewItem =
  | { kind: "post"; post: FeedPost }
  | { kind: "comment"; comment: CommentWithPost }

export type OverviewPage = { data: OverviewItem[]; nextCursor: string | null }

async function fetchOverviewPage(
  username: string,
  cursor: string | undefined,
): Promise<OverviewPage> {
  const { data } = await getApiV1UserByUsernameByUsernameOverview({
    path: { username },
    query: { cursor },
    throwOnError: true,
  })
  // The endpoint's post/comment items are structurally the FeedPost / CommentWithPost
  // shapes the rows expect (they carry a superset of fields).
  return { data: data.data, nextCursor: data.nextCursor }
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

/** Applies a vote/removal transform to every post item across all pages. */
function mapPosts(
  data: InfiniteData<OverviewPage> | undefined,
  fn: (post: FeedPost) => FeedPost | null,
): InfiniteData<OverviewPage> | undefined {
  if (!data) return data
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      data: page.data.flatMap((item): OverviewItem[] => {
        if (item.kind !== "post") return [item]
        const next = fn(item.post)
        return next ? [{ kind: "post", post: next }] : []
      }),
    })),
  }
}

function permalinkForPost(post: FeedPost): string {
  return post.community
    ? `/r/${post.community.name}/comments/${post.id}`
    : `/user/${post.author?.username ?? ""}`
}

/**
 * The profile Overview tab: a single chronological (newest-first) list that
 * intertwines the user's posts and comments, with sort, content-type filter,
 * and card/compact view controls. Infinite scroll.
 */
export function OverviewFeed({ username }: { username: string }) {
  const queryClient = useQueryClient()
  const { view, setView } = useFeedView()
  const [filter, setFilter] = useState<OverviewFilter>("all")

  const queryKey = ["profile-overview", username]

  const list = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchOverviewPage(username, pageParam),
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
    queryClient.setQueryData<InfiniteData<OverviewPage>>(queryKey, (old) =>
      mapPosts(old, (p) =>
        p.id === post.id ? { ...p, userVote: newVote, score: p.score + (newVote - p.userVote) } : p,
      ),
    )
    voteMutation.mutate({ postId: post.id, value: newVote })
  }

  function removePost(postId: string) {
    queryClient.setQueryData<InfiniteData<OverviewPage>>(queryKey, (old) =>
      mapPosts(old, (p) => (p.id === postId ? null : p)),
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

  const allItems = list.data?.pages.flatMap((p) => p.data) ?? []
  // The overview endpoint returns newest-first; the content-type filter is applied
  // client-side (the endpoint itself takes only a cursor).
  const items =
    filter === "all" ? allItems : allItems.filter((item) => item.kind === filter.slice(0, -1))
  const compact = view === "compact"

  const toolbar = (
    <div className="flex items-center gap-2">
      <OverviewFilterMenu value={filter} onChange={setFilter} />
      <div className="ml-auto">
        <FeedViewMenu view={view} onChange={setView} />
      </div>
    </div>
  )

  let body: React.ReactNode
  if (list.isLoading) {
    body = <PostFeedSkeleton variant={view} />
  } else if (list.isError) {
    body = (
      <div className="rounded-lg border bg-card p-10 text-center">
        <p className="text-sm font-medium text-muted-foreground">Could not load overview</p>
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
  } else if (allItems.length === 0) {
    body = (
      <div className="rounded-lg border bg-card p-10 text-center">
        <p className="text-sm font-medium text-muted-foreground">Nothing to show yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          u/{username}&apos;s posts and comments will appear here.
        </p>
      </div>
    )
  } else {
    body = (
      <div className="flex flex-col gap-3">
        {items.length === 0 && !list.isFetchingNextPage ? (
          <div className="rounded-lg border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No {filter === "posts" ? "posts" : "comments"} in this view.
            </p>
          </div>
        ) : null}
        {items.map((item) =>
          item.kind === "post" ? (
            <PostRow
              key={`post-${item.post.id}`}
              post={toDisplayPost(item.post)}
              variant={view}
              href={permalinkForPost(item.post)}
              communityHref={item.post.community ? `/r/${item.post.community.name}` : undefined}
              authorHref={item.post.author ? `/user/${item.post.author.username}` : undefined}
              wrapCommunityLink={wrapCommunityLink}
              wrapAuthorLink={wrapAuthorLink}
              onUpvote={() => {
                vote(item.post, 1)
              }}
              onDownvote={() => {
                vote(item.post, -1)
              }}
              voteDisabled={item.post.isLocked}
              shareSlot={
                <PostShareMenu
                  post={{
                    id: item.post.id,
                    title: item.post.title,
                    community: item.post.community ? { name: item.post.community.name } : null,
                  }}
                  permalink={permalinkForPost(item.post)}
                />
              }
              menuSlot={
                <PostActionsMenu
                  post={{
                    id: item.post.id,
                    type: item.post.type,
                    bodyMd: item.post.bodyMd,
                    isNsfw: item.post.isNsfw,
                    isSpoiler: item.post.isSpoiler,
                    isOc: item.post.isOc,
                    isAuthor: item.post.isAuthor,
                    author: item.post.author ? { username: item.post.author.username } : null,
                    community: item.post.community
                      ? { id: item.post.community.id, name: item.post.community.name }
                      : null,
                    flair: item.post.flair ? { id: item.post.flair.id } : null,
                  }}
                  onHidden={removePost}
                  onDeleted={removePost}
                  onEdited={() => {
                    void list.refetch()
                  }}
                />
              }
            />
          ) : (
            <CommentCard
              key={`comment-${item.comment.id}`}
              comment={item.comment}
              compact={compact}
            />
          ),
        )}
        {list.isFetchingNextPage ? <PostFeedSkeleton count={2} variant={view} /> : null}
        <div ref={sentinelRef} aria-hidden className="h-px" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {toolbar}
      {body}
    </div>
  )
}
