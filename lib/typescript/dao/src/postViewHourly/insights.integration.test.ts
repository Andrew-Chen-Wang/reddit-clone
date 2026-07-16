import { db } from "@template-nextjs/db"
import { v7 } from "uuid"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { fetchPostInsights } from "../postInsights/fetch"
import { crudPostView } from "../postView/crud"
import { hourBucket } from "./crud"
import { fetchPostViewHourly } from "./fetch"

declare const process: { env: Record<string, string | undefined> }

const suffix = v7().slice(0, 8)
const authorId = v7()
const viewerId = v7()
const communityId = v7()
const postId = v7()
const higherScoringPostId = v7()
const crosspostId = v7()
const topCommentId = v7()
const lowCommentId = v7()

beforeAll(async () => {
  await db
    .insertInto("user")
    .values([
      { id: authorId, username: `insights-a-${suffix}`, email: `ia-${suffix}@example.invalid` },
      { id: viewerId, username: `insights-v-${suffix}`, email: `iv-${suffix}@example.invalid` },
    ])
    .execute()

  await db
    .insertInto("community")
    .values({
      id: communityId,
      name: `insights${suffix}`,
      description: "insights test",
      visibility: "public",
      memberCount: 0,
      createdByUserId: authorId,
    })
    .execute()

  await db
    .insertInto("post")
    .values([
      {
        id: postId,
        authorUserId: authorId,
        communityId,
        type: "text",
        title: "insights post",
        ups: 5,
      },
      {
        id: higherScoringPostId,
        authorUserId: authorId,
        communityId,
        type: "text",
        title: "higher scoring post",
        ups: 50,
      },
      {
        id: crosspostId,
        authorUserId: authorId,
        communityId,
        type: "text",
        title: "crosspost of insights post",
        crosspostOfPostId: postId,
      },
    ])
    .execute()

  await db
    .insertInto("comment")
    .values([
      {
        id: topCommentId,
        postId,
        path: [topCommentId],
        authorUserId: viewerId,
        bodyMd: "top comment",
        ups: 20,
      },
      {
        id: lowCommentId,
        postId,
        path: [lowCommentId],
        authorUserId: viewerId,
        bodyMd: "low comment",
        ups: 1,
      },
    ])
    .execute()
})

afterAll(async () => {
  await db.deleteFrom("comment").where("postId", "=", postId).execute()
  await db.deleteFrom("postView").where("postId", "=", postId).execute()
  await db.deleteFrom("postViewHourly").where("postId", "=", postId).execute()
  await db
    .deleteFrom("post")
    .where("id", "in", [postId, higherScoringPostId, crosspostId])
    .execute()
  await db.deleteFrom("community").where("id", "=", communityId).execute()
  await db.deleteFrom("user").where("id", "in", [authorId, viewerId]).execute()
  await db.destroy()
})

describe.skipIf(process.env.CI === "true")("post view hourly + insights", () => {
  it("recordView increments the current hourly bucket", async () => {
    await crudPostView(db).recordView(postId, viewerId)
    await crudPostView(db).recordView(postId, viewerId)

    const bucket = hourBucket(new Date())
    const row = await db
      .selectFrom("postViewHourly")
      .select(["viewCount"])
      .where("postId", "=", postId)
      .where("bucket", "=", bucket)
      .executeTakeFirstOrThrow()

    expect(row.viewCount).toBe(2)
  })

  it("histogram and totals reflect recorded views", async () => {
    const histogram = await fetchPostViewHourly(db).histogram(postId, 48)
    expect(histogram.length).toBe(1)
    expect(histogram[0].count).toBe(2)

    const total = await fetchPostViewHourly(db).totals(postId)
    expect(total).toBe(2)
  })

  it("countCrossposts counts posts crossposted from this one", async () => {
    expect(await fetchPostInsights(db).countCrossposts(postId)).toBe(1)
  })

  it("topComments returns comments ordered by score", async () => {
    const top = await fetchPostInsights(db).topComments(postId, 3)
    expect(top.map((c) => c.id)).toEqual([topCommentId, lowCommentId])
    expect(top[0].score).toBe(20)
    expect(top[0].snippet).toBe("top comment")
  })

  it("rankAllTime ranks by score among the author's posts", async () => {
    // postId has score 5; higherScoringPostId has score 50 -> postId is #2
    expect(await fetchPostInsights(db).rankAllTime(authorId, 5)).toBe(2)
  })
})
