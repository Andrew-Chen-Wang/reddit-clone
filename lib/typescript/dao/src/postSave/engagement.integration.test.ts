import { db } from "@template-nextjs/db"
import { v7 } from "uuid"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { fetchPost } from "../post/fetch"
import { crudPostHide } from "../postHide/crud"
import { crudPostSave } from "./crud"
import { fetchPostSave } from "./fetch"

declare const process: { env: Record<string, string | undefined> }

const suffix = v7().slice(0, 8)
const userId = v7()
const communityId = v7()
const postId = v7()

beforeAll(async () => {
  await db
    .insertInto("user")
    .values({ id: userId, username: `save-${suffix}`, email: `save-${suffix}@example.invalid` })
    .execute()
  await db
    .insertInto("community")
    .values({
      id: communityId,
      name: `savetest${suffix}`,
      description: "save test",
      visibility: "public",
      memberCount: 0,
    })
    .execute()
  await db
    .insertInto("post")
    .values({ id: postId, authorUserId: userId, communityId, type: "text", title: "save post" })
    .execute()
})

afterAll(async () => {
  await db.deleteFrom("postSave").where("postId", "=", postId).execute()
  await db.deleteFrom("postHide").where("postId", "=", postId).execute()
  await db.deleteFrom("post").where("id", "=", postId).execute()
  await db.deleteFrom("community").where("id", "=", communityId).execute()
  await db.deleteFrom("user").where("id", "=", userId).execute()
  await db.destroy()
})

describe.skipIf(process.env.CI === "true")("save and hide engagement", () => {
  it("saves and unsaves a post idempotently", async () => {
    await crudPostSave(db).save(postId, userId)
    await crudPostSave(db).save(postId, userId)
    expect(await fetchPostSave(db).isSaved(postId, userId)).toBe(true)

    const removed = await crudPostSave(db).unsave(postId, userId)
    expect(removed).toBe(true)
    expect(await fetchPostSave(db).isSaved(postId, userId)).toBe(false)
  })

  it("hides a post, surfaces it in the hidden feed, and excludes it from the community feed", async () => {
    await crudPostHide(db).hide(postId, userId)

    const hidden = await fetchPost(db).hiddenPostsFeed(userId).execute()
    expect(hidden.map((r) => r.id)).toContain(postId)

    const feedWithViewer = await fetchPost(db)
      .communityFeed({
        communityId,
        sort: "new",
        windowStart: null,
        excludeSticky: false,
        viewerId: userId,
      })
      .execute()
    expect(feedWithViewer.map((r) => r.id)).not.toContain(postId)

    const feedAnon = await fetchPost(db)
      .communityFeed({ communityId, sort: "new", windowStart: null, excludeSticky: false })
      .execute()
    expect(feedAnon.map((r) => r.id)).toContain(postId)
  })
})
