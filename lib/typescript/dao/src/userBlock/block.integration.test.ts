import { db } from "@template-nextjs/db"
import { v7 } from "uuid"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { fetchPost } from "../post/fetch"
import { crudUserFollow } from "../userFollow/crud"
import { fetchUserFollow } from "../userFollow/fetch"
import { crudUserBlock } from "./crud"
import { fetchUserBlock } from "./fetch"

declare const process: { env: Record<string, string | undefined> }

const suffix = v7().slice(0, 8)
const userA = v7()
const userB = v7()
const communityId = v7()
const profilePostId = v7()

beforeAll(async () => {
  await db
    .insertInto("user")
    .values([
      { id: userA, username: `blk-a-${suffix}`, email: `blk-a-${suffix}@example.invalid` },
      { id: userB, username: `blk-b-${suffix}`, email: `blk-b-${suffix}@example.invalid` },
    ])
    .execute()
  await db
    .insertInto("community")
    .values({
      id: communityId,
      name: `blktest${suffix}`,
      description: "block test",
      visibility: "public",
      memberCount: 0,
    })
    .execute()
  await db
    .insertInto("post")
    .values({
      id: profilePostId,
      authorUserId: userB,
      communityId,
      type: "text",
      title: "post by B",
    })
    .execute()
})

afterAll(async () => {
  await db.deleteFrom("userFollow").where("followerUserId", "in", [userA, userB]).execute()
  await db.deleteFrom("userBlock").where("blockerUserId", "in", [userA, userB]).execute()
  await db.deleteFrom("post").where("id", "=", profilePostId).execute()
  await db.deleteFrom("community").where("id", "=", communityId).execute()
  await db.deleteFrom("user").where("id", "in", [userA, userB]).execute()
  await db.destroy()
})

describe.skipIf(process.env.CI === "true")("user block behavior", () => {
  it("removes mutual follows when a block is created", async () => {
    await crudUserFollow(db).follow(userA, userB)
    await crudUserFollow(db).follow(userB, userA)
    expect(await fetchUserFollow(db).isFollowing(userA, userB)).toBe(true)
    expect(await fetchUserFollow(db).isFollowing(userB, userA)).toBe(true)

    await crudUserBlock(db).block(userA, userB)

    expect(await fetchUserFollow(db).isFollowing(userA, userB)).toBe(false)
    expect(await fetchUserFollow(db).isFollowing(userB, userA)).toBe(false)
    expect(await fetchUserBlock(db).isBlockedEither(userA, userB)).toBe(true)
  })

  it("counts blocks for cap enforcement", async () => {
    expect(await fetchUserBlock(db).count(userA)).toBe(1)
  })

  it("excludes posts authored by a blocked user from the home feed", async () => {
    const rows = await fetchPost(db)
      .homeFeed({
        communityIds: [communityId],
        viewerId: userA,
        sort: "new",
        windowStart: null,
        excludeViewed: false,
        followedUserIds: [],
      })
      .execute()
    expect(rows.map((r) => r.id)).not.toContain(profilePostId)
  })
})
