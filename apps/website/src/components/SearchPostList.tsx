"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import { PostRow, type PostRowPost } from "@ui/seo-shared/post/PostRow"
import { PostFeedSkeleton } from "@ui/seo-shared/post/PostRowSkeleton"
import { LoginPromptDialog } from "@ui/seo-shared/LoginPromptDialog"
import { getApiV1Search } from "@lib/api-client/generated/sdk.gen"
import { useEffect, useRef, useState } from "react"

type SearchPage = { posts: PostRowPost[]; nextCursor: string | null }

function permalinkFor(post: PostRowPost): string {
  if (post.community) return `/r/${post.community.name}/comments/${post.id}`
  if (post.author) return `/user/${post.author.username}`
  return "/"
}

export type SearchPostListProps = {
  q: string
  type: "posts" | "media"
  sort: string
  t: string
  communityId?: string | null
  author?: string | null
  initialPosts: PostRowPost[]
  initialCursor: string | null
}

/**
 * Anonymous search post list. The first page is server-rendered and passed in as
 * `initialPosts`; this island continues pagination through the search API. Voting
 * opens a login prompt.
 */
export function SearchPostList({
  q,
  type,
  sort,
  t,
  communityId,
  author,
  initialPosts,
  initialCursor,
}: SearchPostListProps) {
  const [loginOpen, setLoginOpen] = useState(false)

  const feed = useInfiniteQuery({
    queryKey: ["anon-search", q, type, sort, t, communityId ?? null, author ?? null],
    initialPageParam: initialCursor ?? undefined,
    enabled: initialCursor != null,
    queryFn: async ({ pageParam }): Promise<SearchPage> => {
      const { data } = await getApiV1Search({
        query: {
          q,
          type,
          sort,
          t,
          communityId: communityId ?? undefined,
          authorUsername: author ?? undefined,
          cursor: pageParam,
        } as never,
        throwOnError: true,
      })
      return { posts: data.posts, nextCursor: data.nextCursor }
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })

  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && feed.hasNextPage && !feed.isFetchingNextPage) {
          void feed.fetchNextPage()
        }
      },
      { rootMargin: "600px" },
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
    }
  }, [feed.hasNextPage, feed.isFetchingNextPage, feed])

  const posts = [...initialPosts, ...(feed.data?.pages.flatMap((p) => p.posts) ?? [])]

  function openLogin() {
    setLoginOpen(true)
  }

  return (
    <div className="flex flex-col gap-3">
      {posts.map((post) => (
        <PostRow
          key={post.id}
          post={post}
          variant="card"
          href={permalinkFor(post)}
          communityHref={post.community ? `/r/${post.community.name}` : undefined}
          authorHref={post.author ? `/user/${post.author.username}` : undefined}
          onUpvote={openLogin}
          onDownvote={openLogin}
        />
      ))}
      {feed.isFetchingNextPage ? <PostFeedSkeleton count={2} /> : null}
      <div ref={sentinelRef} aria-hidden className="h-px" />
      <LoginPromptDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </div>
  )
}
