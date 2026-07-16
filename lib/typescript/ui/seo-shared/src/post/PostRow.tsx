"use client"

import type { CSSProperties, ReactNode } from "react"
import { Lock, MessageSquare, Pin, Share2 } from "lucide-react"
import { Badge } from "@ui/base/ui/badge"
import { SeoLink } from "@ui/seo-shared/_internal/seo-link"
import { CommunityIcon } from "@ui/seo-shared/community/CommunityIcon"
import { formatCompactNumber } from "@ui/seo-shared/format-number"
import { markdownToText } from "@ui/seo-shared/markdown-to-text"
import { RelativeTime } from "@ui/seo-shared/RelativeTime"
import { VoteCluster } from "@ui/seo-shared/post/VoteCluster"
import { MediaGallery, type MediaGalleryItem } from "@ui/seo-shared/post/MediaGallery"
import { Film } from "lucide-react"

export type PostRowPost = {
  id: string
  type: string
  title: string
  bodyMd: string | null
  linkUrl: string | null
  isNsfw: boolean
  isSpoiler: boolean
  isOc: boolean
  isLocked: boolean
  stickyPosition: number | null
  score: number
  commentCount: number
  createdAt: string | Date
  editedAt: string | Date | null
  userVote: number
  author: { username: string; displayName: string | null } | null
  community: { name: string; displayName: string | null; iconImageKey: string | null } | null
  flair: { text: string; bgColor: string | null; textColor: string | null } | null
  media?: MediaGalleryItem[]
}

/** Small square thumbnail of a post's first media item, used in compact rows. */
function CompactMediaThumb({ media }: { media: MediaGalleryItem[] }) {
  const first = media[0]
  if (!first) return null
  if (first.mediaType === "video") {
    return (
      <div className="flex size-12 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
        <Film className="size-5" />
      </div>
    )
  }
  return (
    // oxlint-disable-next-line no-img-element
    <img
      src={first.url}
      alt=""
      loading="lazy"
      className="size-12 shrink-0 rounded-md border object-cover"
    />
  )
}

export type PostRowProps = {
  post: PostRowPost
  variant?: "card" | "compact"
  /** Permalink to the post detail page. */
  href: string
  /** Link to the community (r/name). Omit to render community name as plain text. */
  communityHref?: string
  /** Link to the author profile (u/username). */
  authorHref?: string
  onUpvote: () => void
  onDownvote: () => void
  voteDisabled?: boolean
  /** When provided, renders a Share button that copies/props out the permalink. */
  onShare?: () => void
  /** Show the community identity line (icon + r/name). Defaults to true. */
  showCommunity?: boolean
  /** Right-aligned action menu (e.g. overflow dropdown). */
  menuSlot?: ReactNode
}

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

function flairStyle(flair: NonNullable<PostRowPost["flair"]>): CSSProperties | undefined {
  if (!flair.bgColor && !flair.textColor) return undefined
  return {
    backgroundColor: flair.bgColor ?? undefined,
    color: flair.textColor ?? undefined,
  }
}

function Badges({ post }: { post: PostRowPost }) {
  return (
    <>
      {post.flair ? (
        <Badge variant="secondary" className="max-w-40 truncate" style={flairStyle(post.flair)}>
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
    </>
  )
}

function MetaLine({
  post,
  communityHref,
  authorHref,
  showCommunity,
  compact,
}: {
  post: PostRowPost
  communityHref?: string
  authorHref?: string
  showCommunity: boolean
  compact?: boolean
}) {
  const community = post.community
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
      {post.stickyPosition !== null ? (
        <Pin className="size-3.5 shrink-0 text-green-600 dark:text-green-500" aria-label="Pinned" />
      ) : null}
      {showCommunity && community ? (
        <>
          {!compact ? (
            <CommunityIcon name={community.name} iconUrl={community.iconImageKey} size="sm" />
          ) : null}
          {communityHref ? (
            <SeoLink href={communityHref} className="font-medium text-foreground hover:underline">
              r/{community.name}
            </SeoLink>
          ) : (
            <span className="font-medium text-foreground">r/{community.name}</span>
          )}
          <span aria-hidden>·</span>
        </>
      ) : null}
      {(!showCommunity || !community) && post.author ? (
        <>
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
    </div>
  )
}

function Footer({
  post,
  href,
  onUpvote,
  onDownvote,
  voteDisabled,
  onShare,
}: {
  post: PostRowPost
  href: string
  onUpvote: () => void
  onDownvote: () => void
  voteDisabled?: boolean
  onShare?: () => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <VoteCluster
        score={post.score}
        userVote={post.userVote}
        onUpvote={onUpvote}
        onDownvote={onDownvote}
        disabled={voteDisabled}
      />
      <SeoLink
        href={href}
        className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/70"
      >
        <MessageSquare className="size-4" />
        {formatCompactNumber(post.commentCount)}
      </SeoLink>
      {onShare ? (
        <button
          type="button"
          onClick={onShare}
          className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/70"
        >
          <Share2 className="size-4" />
          Share
        </button>
      ) : null}
    </div>
  )
}

/**
 * Reddit-style post row. Presentational and props-only: navigation goes through
 * `SeoLink` (each frontend aliases it to its router's link) and vote/share actions
 * are supplied by the caller. Two variants: `card` (full preview) and `compact`
 * (dense one-line). Shared between the Next.js SEO site and the dashboard SPA.
 */
export function PostRow({
  post,
  variant = "card",
  href,
  communityHref,
  authorHref,
  onUpvote,
  onDownvote,
  voteDisabled,
  onShare,
  showCommunity = true,
  menuSlot,
}: PostRowProps) {
  const media = post.media ?? []
  const hasMedia = post.type === "media" && media.length > 0

  if (variant === "compact") {
    return (
      <article className="flex items-center gap-3 border-b px-3 py-2 last:border-b-0 hover:bg-muted/40">
        <VoteCluster
          score={post.score}
          userVote={post.userVote}
          onUpvote={onUpvote}
          onDownvote={onDownvote}
          disabled={voteDisabled}
          size="sm"
        />
        {showCommunity && post.community ? (
          <CommunityIcon
            name={post.community.name}
            iconUrl={post.community.iconImageKey}
            size="sm"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            {post.isLocked ? <Lock className="size-3.5 shrink-0 text-muted-foreground" /> : null}
            <SeoLink href={href} className="truncate text-sm font-medium hover:underline">
              {post.title}
            </SeoLink>
            <Badges post={post} />
          </div>
          <MetaLine
            post={post}
            communityHref={communityHref}
            authorHref={authorHref}
            showCommunity={showCommunity}
            compact
          />
        </div>
        <SeoLink
          href={href}
          className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground hover:underline sm:inline-flex"
        >
          <MessageSquare className="size-4" />
          {formatCompactNumber(post.commentCount)}
        </SeoLink>
        {hasMedia ? <CompactMediaThumb media={media} /> : null}
        {menuSlot}
      </article>
    )
  }

  const preview = post.type === "text" && post.bodyMd ? markdownToText(post.bodyMd, 280) : null

  return (
    <article className="flex flex-col gap-2 rounded-lg border bg-card p-3 transition-colors hover:border-muted-foreground/30">
      <div className="flex items-start justify-between gap-2">
        <MetaLine
          post={post}
          communityHref={communityHref}
          authorHref={authorHref}
          showCommunity={showCommunity}
        />
        {menuSlot}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {post.isLocked ? (
          <Lock className="size-4 text-muted-foreground" aria-label="Locked" />
        ) : null}
        <SeoLink href={href} className="text-lg font-semibold leading-snug hover:underline">
          {post.title}
        </SeoLink>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badges post={post} />
      </div>

      {hasMedia ? (
        <MediaGallery media={media} isNsfw={post.isNsfw} isSpoiler={post.isSpoiler} />
      ) : null}

      {preview ? <p className="line-clamp-3 text-sm text-muted-foreground">{preview}</p> : null}

      {post.type === "link" && post.linkUrl ? (
        <a
          href={post.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-muted"
        >
          {domainFromUrl(post.linkUrl)}
        </a>
      ) : null}

      <Footer
        post={post}
        href={href}
        onUpvote={onUpvote}
        onDownvote={onDownvote}
        voteDisabled={voteDisabled}
        onShare={onShare}
      />
    </article>
  )
}
