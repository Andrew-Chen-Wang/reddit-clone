import { db } from "@template-nextjs/db"
import { v7 } from "uuid"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { crudPostRising } from "./crud"
import { fetchPostRising } from "./fetch"

declare const process: { env: Record<string, string | undefined> }

const suffix = v7().slice(0, 8)
const authorId = v7()
const communityA = v7()
const communityB = v7()
const postA1 = v7()
const postA2 = v7()
const postB1 = v7()
const recent = new Date(Date.now() - 5 * 60 * 1000)

beforeAll(async () => {
  await db
    .insertInto("user")
    .values({ id: authorId, username: `rise-${suffix}`, email: `rise-${suffix}@example.invalid` })
    .execute()

  await db
    .insertInto("community")
    .values([
      {
        id: communityA,
        name: `riseA${suffix}`,
        description: "a",
        visibility: "public",
        memberCount: 0,
      },
      {
        id: communityB,
        name: `riseB${suffix}`,
        description: "b",
        visibility: "public",
        memberCount: 0,
      },
    ])
    .execute()

  await db
    .insertInto("post")
    .values([
      {
        id: postA1,
        authorUserId: authorId,
        communityId: communityA,
        type: "text",
        title: "A1",
        ups: 1000,
        downs: 0,
        createdAt: recent,
      },
      {
        id: postA2,
        authorUserId: authorId,
        communityId: communityA,
        type: "text",
        title: "A2",
        ups: 200,
        downs: 0,
        createdAt: recent,
      },
      {
        id: postB1,
        authorUserId: authorId,
        communityId: communityB,
        type: "text",
        title: "B1",
        ups: 10,
        downs: 0,
        createdAt: recent,
      },
    ])
    .execute()
})

afterAll(async () => {
  await db.deleteFrom("postRising").where("postId", "in", [postA1, postA2, postB1]).execute()
  await db.deleteFrom("post").where("id", "in", [postA1, postA2, postB1]).execute()
  await db.deleteFrom("community").where("id", "in", [communityA, communityB]).execute()
  await db.deleteFrom("user").where("id", "=", authorId).execute()
  await db.destroy()
})

describe.skipIf(process.env.CI === "true")("crudPostRising.recomputeRising", () => {
  it("normalizes scores within each community", async () => {
    await crudPostRising(db).recomputeRising()

    const rowsA = await fetchPostRising(db).getManyByCommunity(communityA, ["postId", "score"])
    const rowsB = await fetchPostRising(db).getManyByCommunity(communityB, ["postId", "score"])

    const a1 = rowsA.find((r) => r.postId === postA1)
    const a2 = rowsA.find((r) => r.postId === postA2)
    const b1 = rowsB.find((r) => r.postId === postB1)

    expect(a1).toBeDefined()
    expect(a2).toBeDefined()
    expect(b1).toBeDefined()

    // Each community's top post normalizes to 1.0
    expect(a1?.score).toBeCloseTo(1, 5)
    expect(b1?.score).toBeCloseTo(1, 5)
    // Within a community, higher raw score ranks higher
    expect(a1?.score).toBeGreaterThan(a2?.score ?? 0)
    // Normalization lets a low-raw post in a quiet community outrank a high-raw post elsewhere
    expect(b1?.score).toBeGreaterThan(a2?.score ?? 0)
  })
})
