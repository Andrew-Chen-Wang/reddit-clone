import { db } from "@template-nextjs/db"
import { v7 } from "uuid"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { crudCommentVote } from "./crud"

declare const process: { env: Record<string, string | undefined> }

const suffix = v7().slice(0, 8)
const authorId = v7()
const voterId = v7()
const communityId = v7()
const postId = v7()
const commentId = v7()

async function authorKarma(): Promise<number> {
  const row = await db
    .selectFrom("user")
    .select("commentKarma")
    .where("id", "=", authorId)
    .executeTakeFirstOrThrow()
  return row.commentKarma
}

async function counts(): Promise<{ ups: number; downs: number; score: number }> {
  const row = await db
    .selectFrom("comment")
    .select(["ups", "downs", "score"])
    .where("id", "=", commentId)
    .executeTakeFirstOrThrow()
  return { ups: row.ups, downs: row.downs, score: row.score }
}

beforeAll(async () => {
  await db
    .insertInto("user")
    .values([
      { id: authorId, username: `cvote-author-${suffix}`, email: `cva-${suffix}@example.invalid` },
      { id: voterId, username: `cvote-voter-${suffix}`, email: `cvv-${suffix}@example.invalid` },
    ])
    .execute()

  await db
    .insertInto("community")
    .values({
      id: communityId,
      name: `cvotetest${suffix}`,
      description: "comment vote test",
      visibility: "public",
      memberCount: 0,
    })
    .execute()

  await db
    .insertInto("post")
    .values({ id: postId, authorUserId: authorId, communityId, type: "text", title: "cv post" })
    .execute()

  await db
    .insertInto("comment")
    .values({
      id: commentId,
      postId,
      parentCommentId: null,
      path: [commentId],
      depth: 0,
      authorUserId: authorId,
      bodyMd: "vote target",
    })
    .execute()
})

afterAll(async () => {
  await db.deleteFrom("comment").where("postId", "=", postId).execute()
  await db.deleteFrom("post").where("id", "=", postId).execute()
  await db.deleteFrom("community").where("id", "=", communityId).execute()
  await db.deleteFrom("user").where("id", "in", [authorId, voterId]).execute()
  await db.destroy()
})

describe.skipIf(process.env.CI === "true")("crudCommentVote.setVote transitions", () => {
  it("none -> upvote increments ups, score, and author comment karma", async () => {
    const result = await crudCommentVote(db).setVote(commentId, voterId, 1)
    expect(result).toEqual({ ups: 1, downs: 0, score: 1, userVote: 1 })
    expect(await counts()).toEqual({ ups: 1, downs: 0, score: 1 })
    expect(await authorKarma()).toBe(1)
  })

  it("upvote -> downvote swings counts and karma by two", async () => {
    const result = await crudCommentVote(db).setVote(commentId, voterId, -1)
    expect(result).toEqual({ ups: 0, downs: 1, score: -1, userVote: -1 })
    expect(await counts()).toEqual({ ups: 0, downs: 1, score: -1 })
    expect(await authorKarma()).toBe(-1)
  })

  it("downvote -> clear resets counts, karma, and removes the vote row", async () => {
    const result = await crudCommentVote(db).setVote(commentId, voterId, 0)
    expect(result).toEqual({ ups: 0, downs: 0, score: 0, userVote: 0 })
    expect(await counts()).toEqual({ ups: 0, downs: 0, score: 0 })
    expect(await authorKarma()).toBe(0)

    const vote = await db
      .selectFrom("commentVote")
      .select("value")
      .where("commentId", "=", commentId)
      .where("userId", "=", voterId)
      .executeTakeFirst()
    expect(vote).toBeUndefined()
  })
})
