"use client"

import type { ReactElement, ReactNode } from "react"
import { ArrowLeft, ExternalLink, Lock, MessageSquare, Pin, Share2 } from "lucide-react"
import { Badge } from "@ui/base/ui/badge"
import { cn } from "@ui/base/lib/utils"
import { CommunityIcon } from "@ui/seo-shared/community/CommunityIcon"
import { formatCompactNumber } from "@ui/seo-shared/format-number"
import { Markdown } from "@ui/seo-shared/Markdown"
import { RelativeTime } from "@ui/seo-shared/RelativeTime"
import { SeoLink } from "@ui/seo-shared/_internal/seo-link"
import { VoteCluster } from "@ui/seo-shared/post/VoteCluster"
import { MediaGallery } from "@ui/seo-shared/post/MediaGallery"
import { AdminBadge, AuthorInsightsRow, type PostRowPost } from "@ui/seo-shared/post/PostRow"

export type PostDetailCardProps = {
  post: PostRowPost
  communityHref?: string
  authorHref?: string
  /** Round back-arrow button (Reddit-style). Omit to hide it (e.g. static SSR). */
  onBack?: () => void
  onUpvote: () => void
  onDownvote: () => void
  voteDisabled?: boolean
  onShare?: () => void
  /** Replaces the default share button (e.g. a share dropdown). Takes precedence over onShare. */
  shareSlot?: ReactNode
  /** Extra action slot (e.g. author/mod overflow menu). */
  menuSlot?: ReactNode
  /** Links the author-only "See More Insights" label to the post's insights page. */
  insightsHref?: string
  /** Optionally enrich the r/community link with a hover card (see PostRow). */
  wrapCommunityLink?: (link: ReactElement, name: string) => ReactNode
  /** Optionally enrich the u/author link with a hover card (see PostRow). */
  wrapAuthorLink?: (link: ReactElement, username: string) => ReactNode
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
  onBack,
  onUpvote,
  onDownvote,
  voteDisabled,
  onShare,
  shareSlot,
  menuSlot,
  insightsHref,
  wrapCommunityLink,
  wrapAuthorLink,
}: PostDetailCardProps) {
  const communityLink =
    post.community && communityHref ? (
      <SeoLink href={communityHref} className="font-medium text-foreground hover:underline">
        r/{post.community.name}
      </SeoLink>
    ) : null
  const authorLink =
    post.author && authorHref ? (
      <SeoLink href={authorHref} className="hover:underline">
        u/{post.author.username}
      </SeoLink>
    ) : null
  return (
    <article className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      {/*
        Reddit-style two-line header: a round back button, the community avatar,
        then "r/community · <time>" on line 1 and the author "u/username" on line 2.
      */}
      <div className="flex items-start gap-2">
        {onBack ? (
          <button
            type="button"
            aria-label="Go back"
            onClick={onBack}
            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-5" />
          </button>
        ) : null}
        {post.community ? (
          <CommunityIcon
            name={post.community.name}
            iconUrl={post.community.iconImageKey}
            size="md"
          />
        ) : null}
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            {post.stickyPosition !== null ? (
              <Pin className="size-3.5 text-green-600 dark:text-green-500" aria-label="Pinned" />
            ) : null}
            {post.community ? (
              communityLink ? (
                wrapCommunityLink ? (
                  wrapCommunityLink(communityLink, post.community.name)
                ) : (
                  communityLink
                )
              ) : (
                <span className="font-medium text-foreground">r/{post.community.name}</span>
              )
            ) : null}
            {post.community ? <span aria-hidden>·</span> : null}
            <RelativeTime date={post.createdAt} />
            {post.editedAt ? <span className="italic">(edited)</span> : null}
          </div>
          {post.author ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {authorLink ? (
                wrapAuthorLink ? (
                  wrapAuthorLink(authorLink, post.author.username)
                ) : (
                  authorLink
                )
              ) : (
                <span>u/{post.author.username}</span>
              )}
              {post.author.isAdmin ? <AdminBadge /> : null}
            </div>
          ) : null}
        </div>
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
        post.linkImageUrl ? (
          <a
            href={post.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-fit max-w-full overflow-hidden rounded-lg border hover:border-foreground/30"
          >
            {/* oxlint-disable-next-line no-img-element */}
            <img
              src={post.linkImageUrl}
              alt=""
              loading="lazy"
              className="max-h-96 w-full object-cover"
            />
            <span className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-primary">
              <ExternalLink className="size-4" />
              {domainFromUrl(post.linkUrl)}
            </span>
          </a>
        ) : (
          <a
            href={post.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium text-primary hover:bg-muted"
          >
            {domainFromUrl(post.linkUrl)}
            <ExternalLink className="size-4" />
          </a>
        )
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

      {post.viewCount != null ? (
        <AuthorInsightsRow viewCount={post.viewCount} insightsHref={insightsHref} />
      ) : null}
    </article>
  )
}
