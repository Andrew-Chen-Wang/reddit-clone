import { db } from "@template-nextjs/db"
import { v7 } from "uuid"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { crudUserNotificationPreference } from "../userNotificationPreference/crud"
import { crudNotification } from "./crud"
import { emitCommentReplyAndMentions, emitPostUpvoteMilestone, parseMentions } from "./emit-helpers"
import { fetchNotification } from "./fetch"
import { isUpvoteMilestone } from "./types"

declare const process: { env: Record<string, string | undefined> }

const suffix = v7().slice(0, 8)
const userA = v7()
const userB = v7()
const userC = v7()
const communityId = v7()
const postId = v7()
const nameA = `notifa${suffix}`
const nameC = `notifc${suffix}`

async function listByType(userId: string): Promise<string[]> {
  const rows = await db
    .selectFrom("notification")
    .select("type")
    .where("userId", "=", userId)
    .execute()
  return rows.map((r) => r.type)
}

async function clearNotifications(): Promise<void> {
  await db.deleteFrom("notification").where("userId", "in", [userA, userB, userC]).execute()
}

beforeAll(async () => {
  await db
    .insertInto("user")
    .values([
      { id: userA, username: nameA, email: `${nameA}@example.invalid` },
      { id: userB, username: `notifb${suffix}`, email: `notifb${suffix}@example.invalid` },
      { id: userC, username: nameC, email: `${nameC}@example.invalid` },
    ])
    .execute()

  await db
    .insertInto("community")
    .values({
      id: communityId,
      name: `notiftest${suffix}`,
      description: "notification test",
      visibility: "public",
      memberCount: 0,
    })
    .execute()

  await db
    .insertInto("post")
    .values({
      id: postId,
      authorUserId: userA,
      communityId,
      type: "text",
      title: "notification test post",
    })
    .execute()
})

afterAll(async () => {
  await db.deleteFrom("notification").where("userId", "in", [userA, userB, userC]).execute()
  await db
    .deleteFrom("userNotificationPreference")
    .where("userId", "in", [userA, userB, userC])
    .execute()
  await db.deleteFrom("userBlock").where("blockerUserId", "in", [userA, userB, userC]).execute()
  await db.deleteFrom("comment").where("postId", "=", postId).execute()
  await db.deleteFrom("post").where("id", "=", postId).execute()
  await db.deleteFrom("community").where("id", "=", communityId).execute()
  await db.deleteFrom("user").where("id", "in", [userA, userB, userC]).execute()
  await db.destroy()
})

describe("parseMentions", () => {
  it("extracts unique usernames and caps at three", () => {
    expect(parseMentions("hi @alice and @bob")).toEqual(["alice", "bob"])
    expect(parseMentions("@one @two @three @four")).toEqual(["one", "two", "three"])
    expect(parseMentions("@dup @Dup text")).toEqual(["dup"])
    expect(parseMentions("no mentions here")).toEqual([])
  })
})

describe("isUpvoteMilestone", () => {
  it("is true only at powers of ten", () => {
    expect(isUpvoteMilestone(1)).toBe(true)
    expect(isUpvoteMilestone(10)).toBe(true)
    expect(isUpvoteMilestone(100)).toBe(true)
    expect(isUpvoteMilestone(1000)).toBe(true)
    expect(isUpvoteMilestone(11)).toBe(false)
    expect(isUpvoteMilestone(9)).toBe(false)
    expect(isUpvoteMilestone(0)).toBe(false)
  })
})

describe.skipIf(process.env.CI === "true")("crudNotification.emit gate", () => {
  it("never notifies the actor about their own action", async () => {
    const result = await crudNotification(db).emit("mention", { userId: userA, actorUserId: userA })
    expect(result).toBeNull()
  })

  it("skips when either party has blocked the other", async () => {
    await db
      .insertInto("userBlock")
      .values({ blockerUserId: userA, blockedUserId: userB })
      .execute()
    const result = await crudNotification(db).emit("mention", { userId: userA, actorUserId: userB })
    expect(result).toBeNull()
    await db
      .deleteFrom("userBlock")
      .where("blockerUserId", "=", userA)
      .where("blockedUserId", "=", userB)
      .execute()
  })

  it("skips when the recipient set the type level to off", async () => {
    await crudUserNotificationPreference(db).upsert(userA, "chat_request", "off")
    const result = await crudNotification(db).emit("chat_request", {
      userId: userA,
      actorUserId: userB,
    })
    expect(result).toBeNull()
  })

  it("delivers when no preference row exists (default on)", async () => {
    await clearNotifications()
    const result = await crudNotification(db).emit("mention", {
      userId: userA,
      actorUserId: userB,
      previewSnapshot: { body: "hello" },
    })
    expect(result).not.toBeNull()
    expect(await listByType(userA)).toEqual(["mention"])
  })
})

describe.skipIf(process.env.CI === "true")("emitCommentReplyAndMentions", () => {
  it("notifies the post author with a reply and mentioned users, deduping the reply target", async () => {
    await clearNotifications()
    const commentId = v7()
    const bodyMd = `great post @${nameC} and @${nameA}`
    await db
      .insertInto("comment")
      .values({ id: commentId, postId, path: [commentId], depth: 0, authorUserId: userB, bodyMd })
      .execute()

    await emitCommentReplyAndMentions(db, {
      postId,
      commentId,
      parentCommentId: null,
      actorUserId: userB,
      bodyMd,
      communityId,
    })

    const aRows = await db
      .selectFrom("notification")
      .selectAll()
      .where("userId", "=", userA)
      .execute()
    expect(aRows).toHaveLength(1)
    expect(aRows[0].type).toBe("post_reply")
    expect((aRows[0].previewSnapshot as { body?: string }).body).toContain("great post")

    // userA is the reply target, so the @mention of userA must NOT create a second notification.
    expect(await listByType(userA)).toEqual(["post_reply"])
    expect(await listByType(userC)).toEqual(["mention"])
  })
})

describe.skipIf(process.env.CI === "true")("emitPostUpvoteMilestone", () => {
  it("records the milestone count in the snapshot", async () => {
    await clearNotifications()
    await emitPostUpvoteMilestone(db, {
      postId,
      authorUserId: userA,
      actorUserId: userB,
      ups: 10,
      title: "notification test post",
      communityId,
    })
    const row = await db
      .selectFrom("notification")
      .selectAll()
      .where("userId", "=", userA)
      .where("type", "=", "upvote_post")
      .executeTakeFirstOrThrow()
    expect((row.previewSnapshot as { count?: number }).count).toBe(10)
  })
})

describe.skipIf(process.env.CI === "true")("unread count and mark all read", () => {
  it("counts unread notifications and clears them", async () => {
    await clearNotifications()
    await crudNotification(db).emit("new_follower", { userId: userA, actorUserId: userB })
    await crudNotification(db).emit("mention", { userId: userA, actorUserId: userB })
    expect(await fetchNotification(db).unreadCount(userA)).toBe(2)

    await crudNotification(db).markAllRead(userA)
    expect(await fetchNotification(db).unreadCount(userA)).toBe(0)
  })
})
