"use client"

import type { CSSProperties, ReactElement, ReactNode } from "react"
import {
  ExternalLink,
  Eye,
  FileText,
  Link2,
  Lock,
  MessageSquare,
  Pin,
  Play,
  Share2,
} from "lucide-react"
import { Badge } from "@ui/base/ui/badge"
import { cn } from "@ui/base/lib/utils"
import { SeoLink } from "@ui/seo-shared/_internal/seo-link"
import { CommunityIcon } from "@ui/seo-shared/community/CommunityIcon"
import { formatCompactNumber } from "@ui/seo-shared/format-number"
import { markdownToText } from "@ui/seo-shared/markdown-to-text"
import { RelativeTime } from "@ui/seo-shared/RelativeTime"
import { VoteCluster } from "@ui/seo-shared/post/VoteCluster"
import { MediaGallery, type MediaGalleryItem } from "@ui/seo-shared/post/MediaGallery"

export type PostRowPost = {
  id: string
  type: string
  title: string
  bodyMd: string | null
  linkUrl: string | null
  /**
   * Preview image scraped from a link post's target (Open Graph). Optional: the
   * SSR DAO already provides it; the generated SPA client gains it once the
   * post serializer is regenerated. Renders as the link thumbnail/preview.
   * TODO(m16-backend): wire `linkImageUrl` into the OpenAPI post serializer so
   * the generated api-client type carries it (SSR DAO already returns it).
   */
  linkImageUrl?: string | null
  isNsfw: boolean
  isSpoiler: boolean
  isOc: boolean
  isLocked: boolean
  stickyPosition: number | null
  score: number
  commentCount: number
  /** Total post views. Optional so callers without the field (e.g. mod queue) still fit. */
  viewCount?: number | null
  createdAt: string | Date
  editedAt: string | Date | null
  userVote: number
  /**
   * `isAdmin` marks a site admin so the header renders an ADMIN badge next to the
   * username (like the OP badge). Optional until the post serializer carries it.
   * TODO(m17-backend): add `author.isAdmin` to the OpenAPI post serializer.
   */
  author: { username: string; displayName: string | null; isAdmin?: boolean } | null
  community: { name: string; displayName: string | null; iconImageKey: string | null } | null
  flair: { text: string; bgColor: string | null; textColor: string | null } | null
  media?: MediaGalleryItem[]
}

const COMPACT_THUMB = "h-20 w-28 shrink-0 overflow-hidden rounded-lg border"
const COMPACT_THUMB_PLACEHOLDER = cn(
  COMPACT_THUMB,
  "flex items-center justify-center bg-muted text-muted-foreground",
)

/**
 * Reddit-style left thumbnail for a compact row. Media images render the first
 * item; videos and text posts show an icon placeholder; link posts show an
 * external-link placeholder with the domain overlaid. For link posts the
 * thumbnail is itself the external link (raised above the card overlay); for
 * other types it stays static so a click falls through to the post-detail
 * overlay, matching reddit's compact behavior.
 */
function CompactThumb({ post, media }: { post: PostRowPost; media: MediaGalleryItem[] }) {
  const first = post.type === "media" ? media[0] : undefined

  if (first && first.mediaType !== "video") {
    return (
      // oxlint-disable-next-line no-img-element
      <img src={first.url} alt="" loading="lazy" className={cn(COMPACT_THUMB, "object-cover")} />
    )
  }
  if (first && first.mediaType === "video") {
    return (
      <div className={COMPACT_THUMB_PLACEHOLDER}>
        <Play className="size-6 fill-current" />
      </div>
    )
  }
  if (post.type === "link" && post.linkUrl) {
    const domain = domainFromUrl(post.linkUrl)
    return (
      <a
        href={post.linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={domain}
        className={cn(
          COMPACT_THUMB,
          "relative z-10 flex items-center justify-center bg-muted text-muted-foreground hover:bg-muted/70",
        )}
      >
        {post.linkImageUrl ? (
          // oxlint-disable-next-line no-img-element
          <img
            src={post.linkImageUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <Link2 className="size-6" />
        )}
        <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded bg-black/60 text-white">
          <ExternalLink className="size-3" />
        </span>
        <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1 text-[10px] font-medium text-white">
          {domain}
        </span>
      </a>
    )
  }
  return (
    <div className={COMPACT_THUMB_PLACEHOLDER}>
      <FileText className="size-6" />
    </div>
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
  /** Replaces the default share button (e.g. a share dropdown). Takes precedence over onShare. */
  shareSlot?: ReactNode
  /** Show the community identity line (icon + r/name). Defaults to true. */
  showCommunity?: boolean
  /** Right-aligned action menu (e.g. overflow dropdown). */
  menuSlot?: ReactNode
  /** Right-aligned Join control in the header (shown on multi-community feeds). */
  joinSlot?: ReactNode
  /** Links the author-only "See More Insights" label to the post's insights page. */
  insightsHref?: string
  /**
   * Optionally enrich the r/community link with a hover card. Receives the plain
   * link element and the community name and returns the wrapped node. Omit on the
   * anon/SSR site so the link degrades to a plain anchor.
   */
  wrapCommunityLink?: (link: ReactElement, name: string) => ReactNode
  /** Optionally enrich the u/author link with a hover card. See {@link wrapCommunityLink}. */
  wrapAuthorLink?: (link: ReactElement, username: string) => ReactNode
}

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

/** Small red "ADMIN" chip shown after the username when the author is a site admin. */
export function AdminBadge() {
  return (
    <span className="rounded-sm bg-red-600 px-1 text-[10px] font-bold uppercase leading-tight tracking-wide text-white dark:bg-red-500">
      Admin
    </span>
  )
}

/**
 * Reddit-style author-only insights row: "N views" on the left, "See More
 * Insights" on the right. Rendered on its own line below the action row and only
 * for the author (the backend sends `viewCount` to the author only, so callers
 * gate on `viewCount != null`). When `insightsHref` is supplied the right label
 * links to the post's insights page; otherwise it renders as a plain label.
 */
export function AuthorInsightsRow({
  viewCount,
  insightsHref,
}: {
  viewCount: number
  insightsHref?: string
}) {
  return (
    <div className="relative z-10 mt-1 flex items-center justify-between">
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Eye className="size-4" />
        {formatCompactNumber(viewCount)} views
      </span>
      {insightsHref ? (
        <SeoLink href={insightsHref} className="text-xs font-semibold text-primary hover:underline">
          See More Insights
        </SeoLink>
      ) : (
        <span className="text-xs font-semibold text-muted-foreground">See More Insights</span>
      )}
    </div>
  )
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
  wrapCommunityLink,
  wrapAuthorLink,
}: {
  post: PostRowPost
  communityHref?: string
  authorHref?: string
  showCommunity: boolean
  wrapCommunityLink?: (link: ReactElement, name: string) => ReactNode
  wrapAuthorLink?: (link: ReactElement, username: string) => ReactNode
}) {
  const community = post.community
  const author = post.author
  // Links carry `relative z-10` so they sit above the full-card click overlay.
  const communityLink =
    community && communityHref ? (
      <SeoLink
        href={communityHref}
        className="relative z-10 font-medium text-foreground hover:underline"
      >
        r/{community.name}
      </SeoLink>
    ) : null
  const authorLink =
    author && authorHref ? (
      <SeoLink href={authorHref} className="relative z-10 hover:underline">
        u/{author.username}
      </SeoLink>
    ) : null
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
      {post.stickyPosition !== null ? (
        <Pin className="size-3.5 shrink-0 text-green-600 dark:text-green-500" aria-label="Pinned" />
      ) : null}
      {showCommunity && community ? (
        <>
          <CommunityIcon name={community.name} iconUrl={community.iconImageKey} size="sm" />
          {communityLink ? (
            wrapCommunityLink ? (
              wrapCommunityLink(communityLink, community.name)
            ) : (
              communityLink
            )
          ) : (
            <span className="font-medium text-foreground">r/{community.name}</span>
          )}
          <span aria-hidden>·</span>
        </>
      ) : null}
      {(!showCommunity || !community) && author ? (
        <>
          {authorLink ? (
            wrapAuthorLink ? (
              wrapAuthorLink(authorLink, author.username)
            ) : (
              authorLink
            )
          ) : (
            <span>u/{author.username}</span>
          )}
          {author.isAdmin ? <AdminBadge /> : null}
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
  shareSlot,
}: {
  post: PostRowPost
  href: string
  onUpvote: () => void
  onDownvote: () => void
  voteDisabled?: boolean
  onShare?: () => void
  shareSlot?: ReactNode
}) {
  return (
    <div className="relative z-10 flex w-fit items-center gap-1.5">
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
      {shareSlot ??
        (onShare ? (
          <button
            type="button"
            onClick={onShare}
            className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/70"
          >
            <Share2 className="size-4" />
            Share
          </button>
        ) : null)}
    </div>
  )
}

/**
 * Reddit-style post row. Presentational and props-only: navigation goes through
 * `SeoLink` (each frontend aliases it to its router's link) and vote/share actions
 * are supplied by the caller. Two variants: `card` (full preview) and `compact`
 * (left thumbnail + dense row). Shared between the Next.js SEO site and the dashboard SPA.
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
  shareSlot,
  showCommunity = true,
  menuSlot,
  joinSlot,
  insightsHref,
  wrapCommunityLink,
  wrapAuthorLink,
}: PostRowProps) {
  const media = post.media ?? []
  const hasMedia = post.type === "media" && media.length > 0

  if (variant === "compact") {
    // Reddit compact row: left thumbnail + right column (header, title, action row).
    // Whole-row click-through via the overlay anchor; interactive controls raised.
    return (
      <article className="relative flex items-start gap-3 border-b px-3 py-3 last:border-b-0 hover:bg-muted/40">
        {/* oxlint-disable-next-line jsx-a11y/anchor-has-content */}
        <SeoLink href={href} aria-hidden tabIndex={-1} className="absolute inset-0" />
        <CompactThumb post={post} media={media} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <MetaLine
              post={post}
              communityHref={communityHref}
              authorHref={authorHref}
              showCommunity={showCommunity}
              wrapCommunityLink={wrapCommunityLink}
              wrapAuthorLink={wrapAuthorLink}
            />
            {joinSlot ? <div className="relative z-10 ml-auto shrink-0">{joinSlot}</div> : null}
          </div>

          <div className="flex items-start gap-1.5">
            {post.isLocked ? (
              <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="Locked" />
            ) : null}
            <SeoLink
              href={href}
              className="relative z-10 line-clamp-2 text-base font-semibold leading-snug"
            >
              {post.title}
            </SeoLink>
          </div>

          {post.flair || post.isNsfw || post.isSpoiler || post.isOc ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <Badges post={post} />
            </div>
          ) : null}

          <div className="flex items-center gap-1.5">
            <Footer
              post={post}
              href={href}
              onUpvote={onUpvote}
              onDownvote={onDownvote}
              voteDisabled={voteDisabled}
              onShare={onShare}
              shareSlot={shareSlot}
            />
            {menuSlot ? <div className="relative z-10">{menuSlot}</div> : null}
          </div>

          {post.viewCount != null ? (
            <AuthorInsightsRow viewCount={post.viewCount} insightsHref={insightsHref} />
          ) : null}
        </div>
      </article>
    )
  }

  const preview = post.type === "text" && post.bodyMd ? markdownToText(post.bodyMd, 280) : null

  return (
    <article className="relative flex flex-col gap-2 rounded-lg border-b px-3 py-3 transition-colors last:border-b-0 hover:bg-muted/40">
      {/*
        Reddit-style whole-card click-through: a full-bleed overlay anchor
        navigates to the post detail, while every interactive control (links,
        votes, media, footer) carries `relative z-10` so it sits above the
        overlay and captures its own clicks. Static content (body preview, empty
        space) falls through to the overlay. The visible title link remains the
        keyboard/screen-reader target; the overlay is decorative.
      */}
      {/* oxlint-disable-next-line jsx-a11y/anchor-has-content */}
      <SeoLink href={href} aria-hidden tabIndex={-1} className="absolute inset-0" />
      <div className="flex items-center gap-2">
        <MetaLine
          post={post}
          communityHref={communityHref}
          authorHref={authorHref}
          showCommunity={showCommunity}
          wrapCommunityLink={wrapCommunityLink}
          wrapAuthorLink={wrapAuthorLink}
        />
        <div className="relative z-10 ml-auto flex shrink-0 items-center gap-1">
          {joinSlot}
          {menuSlot}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {post.isLocked ? (
          <Lock className="size-4 text-muted-foreground" aria-label="Locked" />
        ) : null}
        <SeoLink href={href} className="relative z-10 text-lg font-semibold leading-snug">
          {post.title}
        </SeoLink>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badges post={post} />
      </div>

      {hasMedia ? (
        <div className="relative z-10">
          <MediaGallery media={media} isNsfw={post.isNsfw} isSpoiler={post.isSpoiler} />
        </div>
      ) : null}

      {preview ? <p className="line-clamp-3 text-sm text-muted-foreground">{preview}</p> : null}

      {post.type === "link" && post.linkUrl ? (
        post.linkImageUrl ? (
          <a
            href={post.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="relative z-10 block w-fit max-w-full overflow-hidden rounded-lg border hover:border-foreground/30"
          >
            {/* oxlint-disable-next-line no-img-element */}
            <img
              src={post.linkImageUrl}
              alt=""
              loading="lazy"
              className="max-h-80 w-full object-cover"
            />
            <span className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-primary">
              <ExternalLink className="size-3.5" />
              {domainFromUrl(post.linkUrl)}
            </span>
          </a>
        ) : (
          <a
            href={post.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="relative z-10 inline-flex w-fit items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-muted"
          >
            <ExternalLink className="size-3.5" />
            {domainFromUrl(post.linkUrl)}
          </a>
        )
      ) : null}

      <Footer
        post={post}
        href={href}
        onUpvote={onUpvote}
        onDownvote={onDownvote}
        voteDisabled={voteDisabled}
        onShare={onShare}
        shareSlot={shareSlot}
      />

      {post.viewCount != null ? <AuthorInsightsRow viewCount={post.viewCount} /> : null}
    </article>
  )
}
