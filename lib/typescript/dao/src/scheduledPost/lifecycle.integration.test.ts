import { db } from "@template-nextjs/db"
import { v7 } from "uuid"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { crudScheduledPost } from "./crud"
import { fetchScheduledPost } from "./fetch"

declare const process: { env: Record<string, string | undefined> }

const suffix = v7().slice(0, 8)
const userId = v7()
const communityId = v7()
const publishedPostId = v7()
const dueIds: string[] = []

beforeAll(async () => {
  await db
    .insertInto("user")
    .values({ id: userId, username: `sched-${suffix}`, email: `sched-${suffix}@example.invalid` })
    .execute()
  await db
    .insertInto("community")
    .values({
      id: communityId,
      name: `schedtest${suffix}`,
      description: "sched test",
      visibility: "public",
      memberCount: 0,
    })
    .execute()
})

afterAll(async () => {
  await db.deleteFrom("post").where("id", "=", publishedPostId).execute()
  await db.deleteFrom("scheduledPost").where("authorUserId", "=", userId).execute()
  await db.deleteFrom("community").where("id", "=", communityId).execute()
  await db.deleteFrom("user").where("id", "=", userId).execute()
  await db.destroy()
})

describe.skipIf(process.env.CI === "true")("scheduled post lifecycle", () => {
  it("returns only due, scheduled rows from duePage", async () => {
    const past = await crudScheduledPost(db).create({
      authorUserId: userId,
      communityId,
      title: "due now",
      scheduledAt: new Date(Date.now() - 60 * 1000),
    })
    const future = await crudScheduledPost(db).create({
      authorUserId: userId,
      communityId,
      title: "later",
      scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    dueIds.push(past.id, future.id)

    const due = await fetchScheduledPost(db).duePage(new Date(), 50)
    const dueIdSet = due.map((r) => r.id)
    expect(dueIdSet).toContain(past.id)
    expect(dueIdSet).not.toContain(future.id)
  })

  it("marks a scheduled post published and removes it from duePage", async () => {
    const [pastId] = dueIds
    await db
      .insertInto("post")
      .values({
        id: publishedPostId,
        authorUserId: userId,
        communityId,
        type: "text",
        title: "published",
      })
      .execute()

    await crudScheduledPost(db).markPublished(pastId, publishedPostId)

    const row = await fetchScheduledPost(db).getOne(pastId, ["status", "publishedPostId"])
    expect(row?.status).toBe("published")
    expect(row?.publishedPostId).toBe(publishedPostId)

    const due = await fetchScheduledPost(db).duePage(new Date(), 50)
    expect(due.map((r) => r.id)).not.toContain(pastId)
  })

  it("cancels a scheduled post owned by the user", async () => {
    const [, futureId] = dueIds
    const canceled = await crudScheduledPost(db).cancel(futureId, userId)
    expect(canceled).toBe(true)

    const row = await fetchScheduledPost(db).getOne(futureId, ["status"])
    expect(row?.status).toBe("canceled")
  })
})
