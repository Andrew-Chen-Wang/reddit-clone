"use client"

import type { ReactNode } from "react"
import { ExternalLink, Lock, MessageSquare, Pin, Share2 } from "lucide-react"
import { Badge } from "@ui/base/ui/badge"
import { cn } from "@ui/base/lib/utils"
import { CommunityIcon } from "@ui/seo-shared/community/CommunityIcon"
import { formatCompactNumber } from "@ui/seo-shared/format-number"
import { Markdown } from "@ui/seo-shared/Markdown"
import { RelativeTime } from "@ui/seo-shared/RelativeTime"
import { SeoLink } from "@ui/seo-shared/_internal/seo-link"
import { VoteCluster } from "@ui/seo-shared/post/VoteCluster"
import { MediaGallery } from "@ui/seo-shared/post/MediaGallery"
import type { PostRowPost } from "@ui/seo-shared/post/PostRow"

export type PostDetailCardProps = {
  post: PostRowPost
  communityHref?: string
  authorHref?: string
  onUpvote: () => void
  onDownvote: () => void
  voteDisabled?: boolean
  onShare?: () => void
  /** Replaces the default share button (e.g. a share dropdown). Takes precedence over onShare. */
  shareSlot?: ReactNode
  /** Extra action slot (e.g. author/mod overflow menu). */
  menuSlot?: ReactNode
}

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

/** Full presentational view of a single post. Props-only; shared SSR + SPA. */
export function PostDetailCard({
  post,
  communityHref,
  authorHref,
  onUpvote,
  onDownvote,
  voteDisabled,
  onShare,
  shareSlot,
  menuSlot,
}: PostDetailCardProps) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {post.stickyPosition !== null ? (
          <Pin className="size-3.5 text-green-600 dark:text-green-500" aria-label="Pinned" />
        ) : null}
        {post.community ? (
          <>
            <CommunityIcon
              name={post.community.name}
              iconUrl={post.community.iconImageKey}
              size="sm"
            />
            {communityHref ? (
              <SeoLink href={communityHref} className="font-medium text-foreground hover:underline">
                r/{post.community.name}
              </SeoLink>
            ) : (
              <span className="font-medium text-foreground">r/{post.community.name}</span>
            )}
            <span aria-hidden>·</span>
          </>
        ) : null}
        {post.author ? (
          <>
            <span>Posted by</span>
            {authorHref ? (
              <SeoLink href={authorHref} className="hover:underline">
                u/{post.author.username}
              </SeoLink>
            ) : (
              <span>u/{post.author.username}</span>
            )}
            <span aria-hidden>·</span>
          </>
        ) : null}
        <RelativeTime date={post.createdAt} />
        {post.editedAt ? <span className="italic">(edited)</span> : null}
        {menuSlot ? <span className="ml-auto">{menuSlot}</span> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {post.isLocked ? (
          <Lock className="size-5 text-muted-foreground" aria-label="Locked" />
        ) : null}
        <h1 className="text-xl font-bold leading-tight">{post.title}</h1>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {post.flair ? (
          <Badge
            variant="secondary"
            style={
              post.flair.bgColor || post.flair.textColor
                ? {
                    backgroundColor: post.flair.bgColor ?? undefined,
                    color: post.flair.textColor ?? undefined,
                  }
                : undefined
            }
          >
            {post.flair.text}
          </Badge>
        ) : null}
        {post.isNsfw ? (
          <Badge variant="destructive" className="uppercase">
            NSFW
          </Badge>
        ) : null}
        {post.isSpoiler ? <Badge variant="outline">Spoiler</Badge> : null}
        {post.isOc ? (
          <Badge variant="outline" className="border-sky-500/50 text-sky-600 dark:text-sky-400">
            OC
          </Badge>
        ) : null}
      </div>

      {post.type === "media" && post.media && post.media.length > 0 ? (
        <MediaGallery media={post.media} isNsfw={post.isNsfw} isSpoiler={post.isSpoiler} />
      ) : null}

      {post.type === "text" && post.bodyMd ? <Markdown content={post.bodyMd} /> : null}

      {post.type === "link" && post.linkUrl ? (
        <a
          href={post.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium text-primary hover:bg-muted"
        >
          {domainFromUrl(post.linkUrl)}
          <ExternalLink className="size-4" />
        </a>
      ) : null}

      <div className="flex items-center gap-1.5 pt-1">
        <VoteCluster
          score={post.score}
          userVote={post.userVote}
          onUpvote={onUpvote}
          onDownvote={onDownvote}
          disabled={voteDisabled}
        />
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
          <MessageSquare className="size-4" />
          {formatCompactNumber(post.commentCount)}
        </span>
        {shareSlot ??
          (onShare ? (
            <button
              type="button"
              onClick={onShare}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/70",
              )}
            >
              <Share2 className="size-4" />
              Share
            </button>
          ) : null)}
      </div>
    </article>
  )
}
