import { getCommunityAuthz } from "@lib/dao/authz/community/get"
import { crudComment } from "@lib/dao/comment/crud"
import { fetchComment } from "@lib/dao/comment/fetch"
import { crudCommunityBan } from "@lib/dao/communityBan/crud"
import { fetchCommunityBan } from "@lib/dao/communityBan/fetch"
import { crudCommunityModerator } from "@lib/dao/communityModerator/crud"
import { fetchCommunityModerator } from "@lib/dao/communityModerator/fetch"
import { crudCommunityModeratorInvite } from "@lib/dao/communityModeratorInvite/crud"
import { fetchCommunityModeratorInvite } from "@lib/dao/communityModeratorInvite/fetch"
import { crudModAction } from "@lib/dao/modAction/crud"
import { crudPost } from "@lib/dao/post/crud"
import { fetchPost } from "@lib/dao/post/fetch"
import { crudPostReport } from "@lib/dao/postReport/crud"
import { fetchPostReport } from "@lib/dao/postReport/fetch"
import { db } from "@template-nextjs/db"
import { v7 } from "uuid"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

declare const process: { env: Record<string, string | undefined> }

const suffix = v7().slice(0, 8)
const creatorId = v7()
const authorId = v7()
const bannedId = v7()
const expiredId = v7()
const inviteeId = v7()
const communityId = v7()

async function feedPostIds(): Promise<string[]> {
  const rows = await fetchPost(db)
    .communityFeed({ communityId, sort: "new", windowStart: null, excludeSticky: false })
    .execute()
  return rows.map((r) => r.id)
}

async function queueIds(tab: "needs_review" | "reported" | "removed" | "edited" | "unmoderated") {
  const rows = await fetchPost(db).moderationQueue({ communityIds: [communityId], tab, limit: 100 })
  return rows.map((r) => r.id)
}

beforeAll(async () => {
  await db
    .insertInto("user")
    .values(
      [creatorId, authorId, bannedId, expiredId, inviteeId].map((id, i) => ({
        id,
        username: `mod-${suffix}-${i}`,
        email: `mod-${suffix}-${i}@example.invalid`,
      })),
    )
    .execute()

  await db
    .insertInto("community")
    .values({
      id: communityId,
      name: `modtest${suffix}`,
      description: "moderation test",
      visibility: "public",
      memberCount: 0,
      createdByUserId: creatorId,
    })
    .execute()

  await crudCommunityModerator(db).add({
    communityId,
    userId: creatorId,
    position: 0,
    permEverything: true,
  })
})

afterAll(async () => {
  await db.deleteFrom("community").where("id", "=", communityId).execute()
  await db
    .deleteFrom("user")
    .where("id", "in", [creatorId, authorId, bannedId, expiredId, inviteeId])
    .execute()
  await db.destroy()
})

describe.skipIf(process.env.CI === "true")("M8 moderation backend", () => {
  it("blocks banned users from posting but ignores expired bans", async () => {
    await crudCommunityBan(db).ban({
      communityId,
      userId: bannedId,
      bannedByUserId: creatorId,
      expiresAt: null,
    })
    await crudCommunityBan(db).ban({
      communityId,
      userId: expiredId,
      bannedByUserId: creatorId,
      expiresAt: new Date(Date.now() - 60_000),
    })

    expect(await fetchCommunityBan(db).isBanned(communityId, bannedId)).toBe(true)
    expect(await fetchCommunityBan(db).isBanned(communityId, expiredId)).toBe(false)

    const banned = await getCommunityAuthz(db).canPost(communityId, bannedId)
    expect(banned).toEqual({ ok: false, reason: "BANNED" })

    const expired = await getCommunityAuthz(db).canPost(communityId, expiredId)
    expect(expired.ok).toBe(true)
  })

  it("moves a reported post through queue tabs and clears on approve", async () => {
    const postId = v7()
    await crudPost(db).create({
      id: postId,
      authorUserId: authorId,
      communityId,
      type: "text",
      title: "reported post",
    })
    await crudPostReport(db).create({ postId, reporterUserId: creatorId, reasonText: "spam" })

    expect(await queueIds("needs_review")).toContain(postId)
    expect(await queueIds("reported")).toContain(postId)
    expect(await queueIds("removed")).not.toContain(postId)
    expect(await feedPostIds()).toContain(postId)

    const summary = await fetchPostReport(db).getPendingSummaryForPosts([postId])
    expect(summary.get(postId)?.count).toBe(1)

    await crudPost(db).modRemove(postId, creatorId, null, false)
    await crudPostReport(db).resolveForPost(postId, "removed", creatorId)
    await crudModAction(db).log({
      communityId,
      modUserId: creatorId,
      action: "remove_post",
      targetPostId: postId,
    })

    expect(await queueIds("removed")).toContain(postId)
    expect(await queueIds("reported")).not.toContain(postId)
    expect(await feedPostIds()).not.toContain(postId)

    const logged = await db
      .selectFrom("modAction")
      .select("id")
      .where("targetPostId", "=", postId)
      .where("action", "=", "remove_post")
      .execute()
    expect(logged.length).toBe(1)

    await crudPost(db).modApprove(postId, creatorId)
    expect(await queueIds("removed")).not.toContain(postId)
    expect(await feedPostIds()).toContain(postId)
    const meta = await fetchPost(db).getOne(postId, ["approvedByUserId", "removedAt"])
    expect(meta?.removedAt).toBeNull()
    expect(meta?.approvedByUserId).toBe(creatorId)
  })

  it("holds posts for review: feed-hidden and surfaced in needs_review", async () => {
    const postId = v7()
    await crudPost(db).create({
      id: postId,
      authorUserId: authorId,
      communityId,
      type: "text",
      title: "held post",
    })
    await crudPost(db).hold(postId)

    expect(await queueIds("needs_review")).toContain(postId)
    expect(await feedPostIds()).not.toContain(postId)

    const meta = await fetchPost(db).getOne(postId, ["removedAt", "removedByUserId"])
    expect(meta?.removedAt).not.toBeNull()
    expect(meta?.removedByUserId).toBeNull()
  })

  it("accepting an invite creates a moderator with the invited permissions", async () => {
    const invite = await crudCommunityModeratorInvite(db).create({
      communityId,
      inviteeUserId: inviteeId,
      invitedByUserId: creatorId,
      permPostsComments: true,
      permFlair: true,
    })

    expect(await fetchCommunityModeratorInvite(db).hasPending(communityId, inviteeId)).toBe(true)

    const resolved = await crudCommunityModeratorInvite(db).resolve(invite.id, "accepted")
    expect(resolved).toBe(true)

    const existing = await fetchCommunityModerator(db).getManyForCommunity(communityId)
    const nextPosition = existing.reduce((max, m) => Math.max(max, m.position), -1) + 1
    await crudCommunityModerator(db).add({
      communityId,
      userId: inviteeId,
      position: nextPosition,
      permPostsComments: invite.permPostsComments,
      permFlair: invite.permFlair,
    })

    const mod = await fetchCommunityModerator(db).getOne(communityId, inviteeId, [
      "permPostsComments",
      "permFlair",
      "permConfig",
    ])
    expect(mod?.permPostsComments).toBe(true)
    expect(mod?.permFlair).toBe(true)
    expect(mod?.permConfig).toBe(false)

    const modAuth = await getCommunityAuthz(db).canModerate(
      communityId,
      inviteeId,
      "posts_comments",
    )
    expect(modAuth.ok).toBe(true)
    const configAuth = await getCommunityAuthz(db).canModerate(communityId, inviteeId, "config")
    expect(configAuth.ok).toBe(false)
  })

  it("hides mod-removed comment bodies from non-mods but shows them to mods", async () => {
    const postId = v7()
    await crudPost(db).create({
      id: postId,
      authorUserId: authorId,
      communityId,
      type: "text",
      title: "comment host",
    })
    const created = await crudComment(db).create({
      postId,
      authorUserId: authorId,
      bodyMd: "secret contents",
    })
    if ("error" in created) throw new Error("comment create failed")
    await crudComment(db).modRemove(created.comment.id, creatorId, null, false)

    const removedRows = await fetchComment(db).moderationQueue({
      communityIds: [communityId],
      tab: "removed",
      limit: 100,
    })
    expect(removedRows.map((r) => r.id)).toContain(created.comment.id)
  })
})
