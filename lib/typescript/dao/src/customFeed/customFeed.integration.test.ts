import { db } from "@template-nextjs/db"
import { v7 } from "uuid"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { fetchPost } from "../post/fetch"
import { crudCustomFeed } from "./crud"
import { fetchCustomFeed } from "./fetch"
import { crudCustomFeedCommunity } from "../customFeedCommunity/crud"
import { fetchCustomFeedCommunity } from "../customFeedCommunity/fetch"

declare const process: { env: Record<string, string | undefined> }

const suffix = v7().slice(0, 8)
const ownerId = v7()
const publicCommunityId = v7()
const privateCommunityId = v7()
const createdFeedIds: string[] = []

beforeAll(async () => {
  await db
    .insertInto("user")
    .values({ id: ownerId, username: `cf-${suffix}`, email: `cf-${suffix}@example.invalid` })
    .execute()

  await db
    .insertInto("community")
    .values([
      {
        id: publicCommunityId,
        name: `cfpub${suffix}`,
        description: "public",
        visibility: "public",
        memberCount: 0,
      },
      {
        id: privateCommunityId,
        name: `cfpriv${suffix}`,
        description: "private",
        visibility: "private",
        memberCount: 0,
      },
    ])
    .execute()

  const now = Date.now()
  const posts = [publicCommunityId, privateCommunityId].flatMap((communityId, ci) =>
    Array.from({ length: 3 }, (_, i) => ({
      id: v7(),
      authorUserId: ownerId,
      communityId,
      type: "text",
      title: `post ${ci}-${i}`,
      ups: i + 1,
      downs: 0,
      createdAt: new Date(now - i * 60 * 1000),
    })),
  )
  await db.insertInto("post").values(posts).execute()
})

afterAll(async () => {
  await db
    .deleteFrom("post")
    .where("communityId", "in", [publicCommunityId, privateCommunityId])
    .execute()
  await db.deleteFrom("customFeed").where("ownerUserId", "=", ownerId).execute()
  await db
    .deleteFrom("community")
    .where("id", "in", [publicCommunityId, privateCommunityId])
    .execute()
  await db.deleteFrom("user").where("id", "=", ownerId).execute()
  await db.destroy()
})

describe.skipIf(process.env.CI === "true")("custom feed CRUD and counts", () => {
  it("creates feeds and counts them for the cap check", async () => {
    const a = await crudCustomFeed(db).create({
      ownerUserId: ownerId,
      name: "Bravo Feed",
      slug: "bravo-feed",
    })
    const b = await crudCustomFeed(db).create({
      ownerUserId: ownerId,
      name: "Alpha Feed",
      slug: "alpha-feed",
      isFavorite: true,
    })
    createdFeedIds.push(a.id, b.id)

    expect(await fetchCustomFeed(db).countForOwner(ownerId)).toBe(2)
    expect(await fetchCustomFeed(db).slugsForOwner(ownerId)).toEqual(
      expect.arrayContaining(["bravo-feed", "alpha-feed"]),
    )
  })

  it("lists a user's feeds favorites-first then alphabetically", async () => {
    const feeds = await fetchCustomFeed(db).listForOwner(ownerId, ["slug", "isFavorite"])
    expect(feeds.map((f) => f.slug)).toEqual(["alpha-feed", "bravo-feed"])
    expect(feeds[0].isFavorite).toBe(true)
  })

  it("adds and removes communities without duplicating the pair", async () => {
    const feedId = createdFeedIds[0]
    await crudCustomFeedCommunity(db).add(feedId, publicCommunityId)
    await crudCustomFeedCommunity(db).add(feedId, publicCommunityId)
    await crudCustomFeedCommunity(db).add(feedId, privateCommunityId)

    expect(await fetchCustomFeedCommunity(db).countForFeed(feedId)).toBe(2)
    expect(await fetchCustomFeedCommunity(db).listCommunityIds(feedId)).toEqual(
      expect.arrayContaining([publicCommunityId, privateCommunityId]),
    )

    const removed = await crudCustomFeedCommunity(db).remove(feedId, privateCommunityId)
    expect(removed).toBe(true)
    expect(await fetchCustomFeedCommunity(db).countForFeed(feedId)).toBe(1)
  })
})

describe.skipIf(process.env.CI === "true")("custom feed post visibility filter", () => {
  it("only returns posts from the community ids the viewer may see", async () => {
    // A non-member viewer resolves to only the public community id.
    const visibleOnly = await fetchPost(db)
      .multiCommunityFeed({
        communityIds: [publicCommunityId],
        sort: "new",
        windowStart: null,
        viewerId: null,
      })
      .execute()
    expect(visibleOnly.length).toBe(3)
    expect(visibleOnly.every((p) => p.communityId === publicCommunityId)).toBe(true)

    // A member/mod viewer resolves to both communities.
    const both = await fetchPost(db)
      .multiCommunityFeed({
        communityIds: [publicCommunityId, privateCommunityId],
        sort: "new",
        windowStart: null,
        viewerId: null,
      })
      .execute()
    expect(both.length).toBe(6)
  })
})
