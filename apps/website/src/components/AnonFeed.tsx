"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import { PostRow, type PostRowPost } from "@ui/seo-shared/post/PostRow"
import { PostFeedSkeleton } from "@ui/seo-shared/post/PostRowSkeleton"
import { LoginPromptDialog } from "@ui/seo-shared/LoginPromptDialog"
import {
  getApiV1FeedCommunityByName,
  getApiV1FeedPopular,
  getApiV1FeedProfileByUsername,
} from "@lib/api-client/generated/sdk.gen"
import { useEffect, useRef, useState } from "react"

export type AnonFeedSource =
  | { kind: "community"; name: string }
  | { kind: "popular" }
  | { kind: "profile"; username: string }

type FeedPage = { data: PostRowPost[]; nextCursor: string | null }

function permalinkFor(post: PostRowPost): string {
  if (post.community) return `/r/${post.community.name}/comments/${post.id}`
  if (post.author) return `/user/${post.author.username}`
  return "/"
}

async function fetchPage(
  source: AnonFeedSource,
  sort: string,
  t: string,
  cursor: string | undefined,
): Promise<FeedPage> {
  const query = { sort, t, cursor } as { sort: string; t: string; cursor?: string }
  if (source.kind === "community") {
    const { data } = await getApiV1FeedCommunityByName({
      path: { name: source.name },
      query: query as never,
      throwOnError: true,
    })
    return data
  }
  if (source.kind === "profile") {
    const { data } = await getApiV1FeedProfileByUsername({
      path: { username: source.username },
      query: query as never,
      throwOnError: true,
    })
    return data
  }
  const { data } = await getApiV1FeedPopular({ query: query as never, throwOnError: true })
  return data
}

export type AnonFeedProps = {
  source: AnonFeedSource
  sort: string
  t: string
  initialPosts: PostRowPost[]
  initialCursor: string | null
  /** Show the community identity line on each row. */
  showCommunity?: boolean
}

/**
 * Anonymous (SEO) feed. The first page is server-rendered and passed in as
 * `initialPosts`; this component continues pagination through the API. Every
 * account-gated action (voting) opens a login prompt.
 */
export function AnonFeed({
  source,
  sort,
  t,
  initialPosts,
  initialCursor,
  showCommunity = true,
}: AnonFeedProps) {
  const [loginOpen, setLoginOpen] = useState(false)

  const feed = useInfiniteQuery({
    queryKey: ["anon-feed", source, sort, t],
    queryFn: ({ pageParam }) => fetchPage(source, sort, t, pageParam),
    initialPageParam: initialCursor ?? undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: initialCursor != null,
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

  const morePosts = feed.data?.pages.flatMap((p) => p.data) ?? []
  const posts = [...initialPosts, ...morePosts]

  function openLogin() {
    setLoginOpen(true)
  }

  return (
    <div className="flex flex-col">
      {posts.map((post) => (
        <PostRow
          key={post.id}
          post={post}
          variant="card"
          href={permalinkFor(post)}
          communityHref={post.community ? `/r/${post.community.name}` : undefined}
          authorHref={post.author ? `/user/${post.author.username}` : undefined}
          showCommunity={showCommunity}
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
