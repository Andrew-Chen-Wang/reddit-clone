import { crudPost } from "@lib/dao/post/crud"
import { fetchPost } from "@lib/dao/post/fetch"
import { crudUser } from "@lib/dao/user/crud"
import { sha256 } from "@oslojs/crypto/sha2"
import { encodeHexLowerCase } from "@oslojs/encoding"
import { db } from "@template-nextjs/db"
import { fetchAdmin } from "@lib/dao"
import { Hono } from "hono"
import { v7 } from "uuid"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { authMiddleware } from "../middleware"

declare const process: { env: Record<string, string | undefined> }

const suffix = v7().slice(0, 8)
const userId = v7()
const adminId = v7()
const communityId = v7()
const postId = v7()
const sessionToken = `tok-${v7()}`
const sessionKey = encodeHexLowerCase(sha256(new TextEncoder().encode(sessionToken)))

const app = new Hono().use(authMiddleware).get("/ping", (c) => c.json({ ok: true }))

async function communityFeedIds(): Promise<string[]> {
  const rows = await fetchPost(db)
    .communityFeed({ communityId, sort: "new", windowStart: null, excludeSticky: false })
    .execute()
  return rows.map((r) => r.id)
}

beforeAll(async () => {
  await db
    .insertInto("user")
    .values([
      { id: userId, username: `adm-u-${suffix}`, email: `admu-${suffix}@example.invalid` },
      {
        id: adminId,
        username: `adm-a-${suffix}`,
        email: `adma-${suffix}@example.invalid`,
        isAdmin: true,
      },
    ])
    .execute()

  await db
    .insertInto("session")
    .values({
      sessionKey,
      userId,
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    })
    .execute()

  await db
    .insertInto("community")
    .values({
      id: communityId,
      name: `admintest${suffix}`,
      description: "admin test",
      visibility: "public",
      memberCount: 0,
      createdByUserId: adminId,
    })
    .execute()

  await db
    .insertInto("post")
    .values({
      id: postId,
      authorUserId: userId,
      communityId,
      type: "text",
      title: `admin removable post ${suffix}`,
    })
    .execute()
})

afterAll(async () => {
  await db.deleteFrom("post").where("id", "=", postId).execute()
  await db.deleteFrom("community").where("id", "=", communityId).execute()
  await db.deleteFrom("session").where("sessionKey", "=", sessionKey).execute()
  await db.deleteFrom("user").where("id", "in", [userId, adminId]).execute()
  await db.destroy()
})

describe.skipIf(process.env.CI === "true")("suspended users are rejected by authMiddleware", () => {
  it("allows an active user, rejects once suspended, allows again after unsuspend", async () => {
    const cookie = `session=${sessionToken}`

    const active = await app.request("/ping", { headers: { Cookie: cookie } })
    expect(active.status).toBe(200)

    await crudUser(db).suspend(userId, "spam")
    const suspended = await app.request("/ping", { headers: { Cookie: cookie } })
    expect(suspended.status).toBe(403)

    await crudUser(db).unsuspend(userId)
    const restored = await app.request("/ping", { headers: { Cookie: cookie } })
    expect(restored.status).toBe(200)
  })
})

describe.skipIf(process.env.CI === "true")("admin post removal hides from feeds", () => {
  it("modRemove hides the post, modApprove restores it, search still finds it", async () => {
    expect(await communityFeedIds()).toContain(postId)

    await crudPost(db).modRemove(postId, adminId, null, false)
    expect(await communityFeedIds()).not.toContain(postId)

    const removedSearch = await fetchAdmin(db).searchPosts(
      `admin removable post ${suffix}`,
      null,
      25,
    )
    expect(removedSearch.map((r) => r.id)).toContain(postId)

    await crudPost(db).modApprove(postId, adminId)
    expect(await communityFeedIds()).toContain(postId)
  })
})
