import type { DB } from "@template-nextjs/db"
import { fetchCommunityMember } from "../communityMember/fetch"
import type { Kysely } from "kysely"
import { fetchPostMedia } from "../postMedia/fetch"
import type { RawPostRow } from "./fetch"

declare const process: { env: Record<string, string | undefined> }

function mediaPublicUrl(key: string): string {
  const base = process.env.PUBLIC_MEDIA_BASE_URL ?? ""
  const trimmedBase = base.endsWith("/") ? base.slice(0, -1) : base
  const trimmedKey = key.startsWith("/") ? key.slice(1) : key
  return `${trimmedBase}/${trimmedKey}`
}

export interface ProcessedPostAuthor {
  id: string
  username: string
  displayName: string | null
  avatarImageKey: string | null
  isAdmin: boolean
}

export interface ProcessedCrosspostOf {
  id: string
  title: string
  score: number
  commentCount: number
  linkImageUrl: string | null
  community: { id: string; name: string } | null
  author: { id: string; username: string; displayName: string | null } | null
}

export interface ProcessedPostCommunity {
  id: string
  name: string
  displayName: string | null
  iconImageKey: string | null
  isNsfw: boolean
}

export interface ProcessedPostFlair {
  id: string
  text: string
  bgColor: string | null
  textColor: string | null
}

export interface ProcessedPostMedia {
  mediaType: string
  url: string
  width: number | null
  height: number | null
}

export interface ProcessedPost {
  id: string
  type: string
  title: string
  slug: string | null
  bodyMd: string | null
  linkUrl: string | null
  linkImageUrl: string | null
  isNsfw: boolean
  isSpoiler: boolean
  isOc: boolean
  isLocked: boolean
  stickyPosition: number | null
  ups: number
  downs: number
  score: number
  commentCount: number
  viewCount: number | null
  shareCount: number
  createdAt: string
  editedAt: string | null
  userVote: number
  isAuthor: boolean
  author: ProcessedPostAuthor | null
  community: (ProcessedPostCommunity & { isMember: boolean }) | null
  flair: ProcessedPostFlair | null
  media: ProcessedPostMedia[]
  crosspostOf: ProcessedCrosspostOf | null
}

function unique(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => v !== null))]
}

export async function processPosts(
  db: Kysely<DB>,
  rows: RawPostRow[],
  viewerId: string | null,
): Promise<ProcessedPost[]> {
  if (rows.length === 0) return []

  const postIds = rows.map((r) => r.id)
  const authorIds = unique(rows.map((r) => r.authorUserId))
  const communityIds = unique(rows.map((r) => r.communityId))
  const flairIds = unique(rows.map((r) => r.flairTemplateId))
  const mediaPostIds = rows.filter((r) => r.type === "media").map((r) => r.id)

  const [voteRows, authorRows, communityRows, flairRows, mediaRows] = await Promise.all([
    viewerId
      ? db
          .selectFrom("postVote")
          .select(["postId", "value"])
          .where("userId", "=", viewerId)
          .where("postId", "in", postIds)
          .execute()
      : Promise.resolve([] as { postId: string; value: number }[]),
    authorIds.length
      ? db
          .selectFrom("user")
          .select(["id", "username", "displayName", "avatarImageKey", "isAdmin"])
          .where("id", "in", authorIds)
          .execute()
      : Promise.resolve([] as ProcessedPostAuthor[]),
    communityIds.length
      ? db
          .selectFrom("community")
          .select(["id", "name", "displayName", "iconImageKey", "isNsfw"])
          .where("id", "in", communityIds)
          .execute()
      : Promise.resolve([] as ProcessedPostCommunity[]),
    flairIds.length
      ? db
          .selectFrom("postFlairTemplate")
          .select(["id", "text", "bgColor", "textColor"])
          .where("id", "in", flairIds)
          .execute()
      : Promise.resolve([] as ProcessedPostFlair[]),
    fetchPostMedia(db).getCompletedByPosts(mediaPostIds, [
      "postId",
      "mediaType",
      "s3Key",
      "width",
      "height",
    ]),
  ])

  const voteByPost = new Map(voteRows.map((v) => [v.postId, v.value]))
  const authorById = new Map(authorRows.map((a) => [a.id, a]))
  const membershipMap =
    viewerId && communityIds.length
      ? await fetchCommunityMember(db).getMembershipMap(viewerId, communityIds)
      : new Map<string, unknown>()
  const communityById = new Map(communityRows.map((c) => [c.id, c]))
  const flairById = new Map(flairRows.map((f) => [f.id, f]))

  const mediaByPost = new Map<string, ProcessedPostMedia[]>()
  for (const m of mediaRows) {
    const list = mediaByPost.get(m.postId) ?? []
    list.push({
      mediaType: m.mediaType,
      url: mediaPublicUrl(m.s3Key),
      width: m.width,
      height: m.height,
    })
    mediaByPost.set(m.postId, list)
  }

  const crosspostById = await hydrateCrossposts(db, unique(rows.map((r) => r.crosspostOfPostId)))

  return rows.map((r) => {
    const author = authorById.get(r.authorUserId) ?? null
    const community = r.communityId ? (communityById.get(r.communityId) ?? null) : null
    const flair = r.flairTemplateId ? (flairById.get(r.flairTemplateId) ?? null) : null
    const isAuthor = viewerId !== null && r.authorUserId === viewerId
    const crosspostOf = r.crosspostOfPostId
      ? (crosspostById.get(r.crosspostOfPostId) ?? null)
      : null
    return {
      id: r.id,
      type: r.type,
      title: r.title,
      slug: r.slug,
      bodyMd: r.bodyMd,
      linkUrl: r.linkUrl,
      linkImageUrl: r.linkImageKey ? mediaPublicUrl(r.linkImageKey) : null,
      isNsfw: r.isNsfw,
      isSpoiler: r.isSpoiler,
      isOc: r.isOc,
      isLocked: r.isLocked,
      stickyPosition: r.stickyPosition,
      ups: r.ups,
      downs: r.downs,
      score: r.score,
      commentCount: r.commentCount,
      viewCount: isAuthor ? Number(r.viewCount) : null,
      shareCount: r.shareCount,
      createdAt: r.createdAt.toISOString(),
      editedAt: r.editedAt ? r.editedAt.toISOString() : null,
      userVote: voteByPost.get(r.id) ?? 0,
      isAuthor,
      author: author
        ? {
            id: author.id,
            username: author.username,
            displayName: author.displayName,
            avatarImageKey: author.avatarImageKey,
            isAdmin: author.isAdmin,
          }
        : null,
      crosspostOf,
      community: community
        ? {
            id: community.id,
            name: community.name,
            displayName: community.displayName,
            iconImageKey: community.iconImageKey,
            isNsfw: community.isNsfw,
            isMember: membershipMap.has(community.id),
          }
        : null,
      flair: flair
        ? { id: flair.id, text: flair.text, bgColor: flair.bgColor, textColor: flair.textColor }
        : null,
      media: mediaByPost.get(r.id) ?? [],
    }
  })
}

async function hydrateCrossposts(
  db: Kysely<DB>,
  sourceIds: string[],
): Promise<Map<string, ProcessedCrosspostOf>> {
  const result = new Map<string, ProcessedCrosspostOf>()
  if (sourceIds.length === 0) return result

  const sources = await db
    .selectFrom("post")
    .select(["id", "title", "score", "commentCount", "linkImageKey", "communityId", "authorUserId"])
    .where("id", "in", sourceIds)
    .execute()
  if (sources.length === 0) return result

  const communityIds = unique(sources.map((s) => s.communityId))
  const authorIds = unique(sources.map((s) => s.authorUserId))

  const [communityRows, authorRows] = await Promise.all([
    communityIds.length
      ? db.selectFrom("community").select(["id", "name"]).where("id", "in", communityIds).execute()
      : Promise.resolve([] as { id: string; name: string }[]),
    authorIds.length
      ? db
          .selectFrom("user")
          .select(["id", "username", "displayName"])
          .where("id", "in", authorIds)
          .execute()
      : Promise.resolve([] as { id: string; username: string; displayName: string | null }[]),
  ])
  const communityById = new Map(communityRows.map((c) => [c.id, c]))
  const authorById = new Map(authorRows.map((a) => [a.id, a]))

  for (const s of sources) {
    const community = s.communityId ? (communityById.get(s.communityId) ?? null) : null
    const author = authorById.get(s.authorUserId) ?? null
    result.set(s.id, {
      id: s.id,
      title: s.title,
      score: s.score,
      commentCount: s.commentCount,
      linkImageUrl: s.linkImageKey ? mediaPublicUrl(s.linkImageKey) : null,
      community: community ? { id: community.id, name: community.name } : null,
      author: author
        ? { id: author.id, username: author.username, displayName: author.displayName }
        : null,
    })
  }
  return result
}
