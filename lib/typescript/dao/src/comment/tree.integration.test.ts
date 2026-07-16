import { db } from "@template-nextjs/db"
import { v7 } from "uuid"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { crudComment } from "./crud"
import { fetchComment } from "./fetch"

declare const process: { env: Record<string, string | undefined> }

const suffix = v7().slice(0, 8)
const authorId = v7()
const communityId = v7()

async function newPost(): Promise<string> {
  const id = v7()
  await db
    .insertInto("post")
    .values({ id, authorUserId: authorId, communityId, type: "text", title: `tree ${suffix}` })
    .execute()
  return id
}

async function commentCount(postId: string): Promise<number> {
  const row = await db
    .selectFrom("post")
    .select("commentCount")
    .where("id", "=", postId)
    .executeTakeFirstOrThrow()
  return row.commentCount
}

async function setScore(commentId: string, ups: number, downs: number): Promise<void> {
  await db.updateTable("comment").set({ ups, downs }).where("id", "=", commentId).execute()
}

async function createOrThrow(input: {
  postId: string
  parentCommentId?: string | null
  bodyMd: string
}): Promise<string> {
  const result = await crudComment(db).create({
    postId: input.postId,
    parentCommentId: input.parentCommentId ?? null,
    authorUserId: authorId,
    bodyMd: input.bodyMd,
  })
  if ("error" in result) throw new Error(result.error)
  return result.comment.id
}

beforeAll(async () => {
  await db
    .insertInto("user")
    .values({ id: authorId, username: `tree-${suffix}`, email: `tree-${suffix}@example.invalid` })
    .execute()
  await db
    .insertInto("community")
    .values({
      id: communityId,
      name: `treetest${suffix}`,
      description: "tree test",
      visibility: "public",
      memberCount: 0,
    })
    .execute()
})

afterAll(async () => {
  await db
    .deleteFrom("comment")
    .where("postId", "in", (eb) =>
      eb.selectFrom("post").select("id").where("communityId", "=", communityId),
    )
    .execute()
  await db.deleteFrom("post").where("communityId", "=", communityId).execute()
  await db.deleteFrom("community").where("id", "=", communityId).execute()
  await db.deleteFrom("user").where("id", "=", authorId).execute()
  await db.destroy()
})

describe.skipIf(process.env.CI === "true")("comment tree invariants", () => {
  it("sets path, depth, childCount, and post.commentCount on create", async () => {
    const postId = await newPost()
    const rootId = await createOrThrow({ postId, bodyMd: "root" })
    const childId = await createOrThrow({ postId, parentCommentId: rootId, bodyMd: "child" })
    const grandId = await createOrThrow({ postId, parentCommentId: childId, bodyMd: "grand" })

    const root = await fetchComment(db).getOne(rootId, ["path", "depth", "childCount"])
    const child = await fetchComment(db).getOne(childId, ["path", "depth", "childCount"])
    const grand = await fetchComment(db).getOne(grandId, ["path", "depth"])

    expect(root?.path).toEqual([rootId])
    expect(root?.depth).toBe(0)
    expect(root?.childCount).toBe(1)
    expect(child?.path).toEqual([rootId, childId])
    expect(child?.depth).toBe(1)
    expect(child?.childCount).toBe(1)
    expect(grand?.path).toEqual([rootId, childId, grandId])
    expect(grand?.depth).toBe(2)
    expect(await commentCount(postId)).toBe(3)
  })

  it("hard-deletes a leaf and decrements counters", async () => {
    const postId = await newPost()
    const rootId = await createOrThrow({ postId, bodyMd: "root" })
    const leafId = await createOrThrow({ postId, parentCommentId: rootId, bodyMd: "leaf" })
    expect(await commentCount(postId)).toBe(2)

    const result = await crudComment(db).deleteOwn(leafId, authorId)
    expect(result).toEqual({ mode: "hard" })

    const gone = await fetchComment(db).getOne(leafId, ["id"])
    expect(gone).toBeUndefined()
    const root = await fetchComment(db).getOne(rootId, ["childCount"])
    expect(root?.childCount).toBe(0)
    expect(await commentCount(postId)).toBe(1)
  })

  it("scrubs a comment that has children in place", async () => {
    const postId = await newPost()
    const rootId = await createOrThrow({ postId, bodyMd: "root" })
    await createOrThrow({ postId, parentCommentId: rootId, bodyMd: "child" })
    expect(await commentCount(postId)).toBe(2)

    const result = await crudComment(db).deleteOwn(rootId, authorId)
    expect(result).toEqual({ mode: "scrub" })

    const root = await fetchComment(db).getOne(rootId, [
      "isDeleted",
      "authorUserId",
      "bodyMd",
      "childCount",
    ])
    expect(root).toEqual({ isDeleted: true, authorUserId: null, bodyMd: null, childCount: 1 })
    expect(await commentCount(postId)).toBe(2)
  })

  it("orders roots and siblings by the chosen sort at each level", async () => {
    const postId = await newPost()
    const rootLow = await createOrThrow({ postId, bodyMd: "root low" })
    const rootHigh = await createOrThrow({ postId, bodyMd: "root high" })
    const childLow = await createOrThrow({ postId, parentCommentId: rootHigh, bodyMd: "child low" })
    const childHigh = await createOrThrow({
      postId,
      parentCommentId: rootHigh,
      bodyMd: "child high",
    })
    await setScore(rootLow, 5, 0)
    await setScore(rootHigh, 100, 0)
    await setScore(childLow, 2, 0)
    await setScore(childHigh, 40, 0)

    const { rows } = await fetchComment(db).getTreePage({ postId, sort: "top" })
    const order = rows.map((r) => r.id)
    expect(order.indexOf(rootHigh)).toBeLessThan(order.indexOf(rootLow))
    expect(order.indexOf(childHigh)).toBeLessThan(order.indexOf(childLow))
    expect(order.indexOf(rootHigh)).toBeLessThan(order.indexOf(childHigh))
  })

  it("paginates direct children by offset for load-more", async () => {
    const postId = await newPost()
    const rootId = await createOrThrow({ postId, bodyMd: "root" })
    const parent = await fetchComment(db).getOne(rootId, ["depth"])
    const childIds: string[] = []
    for (let i = 0; i < 3; i++) {
      childIds.push(await createOrThrow({ postId, parentCommentId: rootId, bodyMd: `c${i}` }))
    }
    for (let i = 0; i < 3; i++) await setScore(childIds[i], (i + 1) * 10, 0)

    const page1 = await fetchComment(db).getChildrenPage({
      postId,
      parentId: rootId,
      parentDepth: parent?.depth ?? 0,
      sort: "top",
      offset: 0,
      pageSize: 2,
    })
    expect(page1.rows.filter((r) => r.parentCommentId === rootId)).toHaveLength(2)
    expect(page1.hasMore).toBe(true)

    const page2 = await fetchComment(db).getChildrenPage({
      postId,
      parentId: rootId,
      parentDepth: parent?.depth ?? 0,
      sort: "top",
      offset: 2,
      pageSize: 2,
    })
    expect(page2.rows.filter((r) => r.parentCommentId === rootId)).toHaveLength(1)
    expect(page2.hasMore).toBe(false)
  })
})
