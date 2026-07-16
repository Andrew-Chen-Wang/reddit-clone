import { fetchPost } from "@lib/dao/post/fetch"
import { db } from "@template-nextjs/db"
import { v7 } from "uuid"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { cursorOffsetPaginate } from "../utils/pagination"

declare const process: { env: Record<string, string | undefined> }

const suffix = v7().slice(0, 8)
const authorId = v7()
const communityId = v7()
const postIds: string[] = []
const POST_COUNT = 25
const PAGE_SIZE = 10

beforeAll(async () => {
  await db
    .insertInto("user")
    .values({ id: authorId, username: `feed-${suffix}`, email: `feed-${suffix}@example.invalid` })
    .execute()

  await db
    .insertInto("community")
    .values({
      id: communityId,
      name: `feedtest${suffix}`,
      description: "feed test",
      visibility: "public",
      memberCount: 0,
    })
    .execute()

  const now = Date.now()
  const rows = Array.from({ length: POST_COUNT }, (_, i) => {
    const id = v7()
    postIds.push(id)
    return {
      id,
      authorUserId: authorId,
      communityId,
      type: "text",
      title: `feed post ${i}`,
      ups: i + 1,
      downs: 0,
      createdAt: new Date(now - i * 60 * 1000),
    }
  })
  await db.insertInto("post").values(rows).execute()
})

afterAll(async () => {
  await db.deleteFrom("post").where("communityId", "=", communityId).execute()
  await db.deleteFrom("community").where("id", "=", communityId).execute()
  await db.deleteFrom("user").where("id", "=", authorId).execute()
  await db.destroy()
})

describe.skipIf(process.env.CI === "true")("community hot feed cursor pagination", () => {
  it("walks two pages with no duplicates and no gaps", async () => {
    const fullOrder = (
      await fetchPost(db)
        .communityFeed({ communityId, sort: "hot", windowStart: null, excludeSticky: false })
        .execute()
    ).map((r) => r.id)

    const page1 = await cursorOffsetPaginate({
      query: fetchPost(db).communityFeed({
        communityId,
        sort: "hot",
        windowStart: null,
        excludeSticky: false,
      }),
      cursor: null,
      ordering: "id",
      positionColumn: "post.id",
      pageSize: PAGE_SIZE,
    })

    expect(page1.results.map((r) => r.id)).toEqual(fullOrder.slice(0, PAGE_SIZE))
    expect(page1.nextCursor).not.toBeNull()

    const page2 = await cursorOffsetPaginate({
      query: fetchPost(db).communityFeed({
        communityId,
        sort: "hot",
        windowStart: null,
        excludeSticky: false,
      }),
      cursor: page1.nextCursor,
      ordering: "id",
      positionColumn: "post.id",
      pageSize: PAGE_SIZE,
    })

    expect(page2.results.map((r) => r.id)).toEqual(fullOrder.slice(PAGE_SIZE, PAGE_SIZE * 2))

    const seen = [...page1.results, ...page2.results].map((r) => r.id)
    expect(new Set(seen).size).toBe(seen.length)
  })
})
