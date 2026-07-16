import { db } from "@template-nextjs/db"
import { v7 } from "uuid"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { crudPostVote } from "./crud"

declare const process: { env: Record<string, string | undefined> }

const suffix = v7().slice(0, 8)
const authorId = v7()
const voterId = v7()
const communityId = v7()
const postId = v7()

async function authorKarma(): Promise<number> {
  const row = await db
    .selectFrom("user")
    .select("postKarma")
    .where("id", "=", authorId)
    .executeTakeFirstOrThrow()
  return row.postKarma
}

async function counts(): Promise<{ ups: number; downs: number }> {
  const row = await db
    .selectFrom("post")
    .select(["ups", "downs"])
    .where("id", "=", postId)
    .executeTakeFirstOrThrow()
  return { ups: row.ups, downs: row.downs }
}

beforeAll(async () => {
  await db
    .insertInto("user")
    .values([
      { id: authorId, username: `vote-author-${suffix}`, email: `va-${suffix}@example.invalid` },
      { id: voterId, username: `vote-voter-${suffix}`, email: `vv-${suffix}@example.invalid` },
    ])
    .execute()

  await db
    .insertInto("community")
    .values({
      id: communityId,
      name: `votetest${suffix}`,
      description: "vote test",
      visibility: "public",
      memberCount: 0,
    })
    .execute()

  await db
    .insertInto("post")
    .values({
      id: postId,
      authorUserId: authorId,
      communityId,
      type: "text",
      title: "vote test post",
      ups: 0,
      downs: 0,
    })
    .execute()
})

afterAll(async () => {
  await db.deleteFrom("post").where("id", "=", postId).execute()
  await db.deleteFrom("community").where("id", "=", communityId).execute()
  await db.deleteFrom("user").where("id", "in", [authorId, voterId]).execute()
  await db.destroy()
})

describe.skipIf(process.env.CI === "true")("crudPostVote.setVote transitions", () => {
  it("none -> upvote increments ups, score, and author karma", async () => {
    const result = await crudPostVote(db).setVote(postId, voterId, 1)
    expect(result).toEqual({ ups: 1, downs: 0, score: 1, userVote: 1 })
    expect(await counts()).toEqual({ ups: 1, downs: 0 })
    expect(await authorKarma()).toBe(1)
  })

  it("upvote -> downvote swings counts and karma by two", async () => {
    const result = await crudPostVote(db).setVote(postId, voterId, -1)
    expect(result).toEqual({ ups: 0, downs: 1, score: -1, userVote: -1 })
    expect(await counts()).toEqual({ ups: 0, downs: 1 })
    expect(await authorKarma()).toBe(-1)
  })

  it("downvote -> clear resets counts and karma", async () => {
    const result = await crudPostVote(db).setVote(postId, voterId, 0)
    expect(result).toEqual({ ups: 0, downs: 0, score: 0, userVote: 0 })
    expect(await counts()).toEqual({ ups: 0, downs: 0 })
    expect(await authorKarma()).toBe(0)

    const vote = await db
      .selectFrom("postVote")
      .select("value")
      .where("postId", "=", postId)
      .where("userId", "=", voterId)
      .executeTakeFirst()
    expect(vote).toBeUndefined()
  })
})
