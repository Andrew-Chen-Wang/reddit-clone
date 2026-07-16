import type { InfiniteData } from "@tanstack/react-query"
import { Avatar, AvatarFallback, AvatarImage } from "@ui/base/ui/avatar"
import { cn } from "@ui/base/lib/utils"
import { markdownToText } from "@ui/seo-shared/markdown-to-text"
import type { PostRowPost } from "@ui/seo-shared/post/PostRow"
import { RelativeTime } from "@ui/seo-shared/RelativeTime"
import { SeoLink } from "@frontends/dashboard/components/seo-link"
import { mediaUrl } from "@frontends/dashboard/lib/mediaUrl"
import type { getApiV1Search } from "@lib/api-client/generated/sdk.gen"

type SearchResponse = Awaited<ReturnType<typeof getApiV1Search>>["data"]
export type SearchPageData = NonNullable<SearchResponse>
export type PostResult = SearchPageData["posts"][number]
export type CommentResult = SearchPageData["comments"][number]
export type ProfileResult = SearchPageData["profiles"][number]

export function chipClass(active: boolean): string {
  return cn(
    "shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors",
    active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
  )
}

export function nextVoteValue(current: number, direction: 1 | -1): 1 | 0 | -1 {
  if (direction === 1) return current === 1 ? 0 : 1
  return current === -1 ? 0 : -1
}

export function applyVoteToCache(
  data: InfiniteData<SearchPageData> | undefined,
  postId: string,
  newVote: 1 | 0 | -1,
): InfiniteData<SearchPageData> | undefined {
  if (!data) return data
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      posts: page.posts.map((p) => {
        if (p.id !== postId) return p
        return { ...p, userVote: newVote, score: p.score + (newVote - p.userVote) }
      }),
    })),
  }
}

export function toRowPost(post: PostResult): PostRowPost {
  return {
    ...post,
    community: post.community
      ? { ...post.community, iconImageKey: mediaUrl(post.community.iconImageKey) }
      : null,
  }
}

export function permalinkForPost(post: PostResult): string {
  if (post.community) return `/r/${post.community.name}/comments/${post.id}`
  if (post.author) return `/user/${post.author.username}`
  return "/"
}

export function CommentResultCard({ result }: { result: CommentResult }) {
  const { comment } = result
  const href = `/r/${result.communityName ?? "readit"}/comments/${comment.postId}?comment=${comment.id}`
  return (
    <article className="rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {comment.author ? <span>u/{comment.author.username}</span> : <span>[deleted]</span>}
        <span aria-hidden>·</span>
        <RelativeTime date={comment.createdAt} />
        <span aria-hidden>·</span>
        <span>{comment.score} points</span>
      </div>
      <p className="mt-1.5 line-clamp-3 text-sm">{markdownToText(comment.bodyMd, 320)}</p>
      <SeoLink
        href={href}
        className="mt-2 inline-block text-xs font-medium text-muted-foreground hover:underline"
      >
        on “{result.postTitle}”{result.communityName ? ` in r/${result.communityName}` : null}
      </SeoLink>
    </article>
  )
}

export function ProfileResultCard({ profile }: { profile: ProfileResult }) {
  const initial = (profile.displayName ?? profile.username).charAt(0).toUpperCase()
  return (
    <SeoLink
      href={`/user/${profile.username}`}
      className="flex items-center gap-3 rounded-lg border bg-card p-3 hover:border-muted-foreground/30"
    >
      <Avatar className="size-10">
        {profile.avatarImageKey ? (
          <AvatarImage src={mediaUrl(profile.avatarImageKey) ?? undefined} alt="" />
        ) : null}
        <AvatarFallback>{initial}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">u/{profile.username}</p>
        <p className="truncate text-xs text-muted-foreground">
          {profile.karma} karma
          {profile.about ? ` · ${markdownToText(profile.about, 80)}` : null}
        </p>
      </div>
    </SeoLink>
  )
}
