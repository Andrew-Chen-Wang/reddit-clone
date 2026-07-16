import { faker } from "@faker-js/faker"
import { type Kysely, sql } from "kysely"
import { v7 } from "uuid"

// Seeded comment_vote rows are a small illustrative subset and intentionally do not sum to each
// comment's ups/downs — acceptable slack for dev data where the counters drive the sort math.

const AUTHORS = ["alice", "bob", "carol", "dave", "erin", "frank", "readit-admin"]
const VOTERS = ["alice", "bob", "carol", "dave", "erin", "frank"]
const TARGET_POSTS = 40
const MINUTE = 60 * 1000

interface CommentNode {
  id: string
  postId: string
  parentCommentId: string | null
  path: string[]
  depth: number
  authorUserId: string | null
  bodyMd: string | null
  ups: number
  downs: number
  childCount: number
  isDeleted: boolean
  createdAt: Date
}

function skewedUps(): number {
  const roll = faker.number.float({ min: 0, max: 1 })
  if (roll < 0.04) return faker.number.int({ min: 300, max: 2000 })
  if (roll < 0.25) return faker.number.int({ min: 30, max: 300 })
  return faker.number.int({ min: 0, max: 30 })
}

function skewedDowns(ups: number): number {
  const controversial = faker.number.float({ min: 0, max: 1 }) < 0.18
  return controversial
    ? faker.number.int({ min: Math.floor(ups * 0.6), max: ups + 4 })
    : faker.number.int({ min: 0, max: Math.floor(ups * 0.2) })
}

function makeNode(
  postId: string,
  parent: CommentNode | null,
  authorId: string | null,
): CommentNode {
  const id = v7()
  const depth = parent ? parent.depth + 1 : 0
  const path = parent ? [...parent.path, id] : [id]
  const ups = skewedUps()
  const createdAt = new Date(
    (parent
      ? parent.createdAt.getTime()
      : Date.now() - faker.number.int({ min: 1, max: 240 }) * MINUTE) +
      faker.number.int({ min: 1, max: 90 }) * MINUTE,
  )
  return {
    id,
    postId,
    parentCommentId: parent?.id ?? null,
    path,
    depth,
    authorUserId: authorId,
    bodyMd: faker.lorem.sentences({ min: 1, max: 3 }),
    ups,
    downs: skewedDowns(ups),
    childCount: 0,
    isDeleted: false,
    createdAt,
  }
}

export async function seed(db: Kysely<any>): Promise<void> {
  const existing = await db.selectFrom("comment").select("id").limit(1).executeTakeFirst()
  if (existing) return

  faker.seed(20260616)

  const users = await db.selectFrom("user").select(["id", "username"]).execute()
  const userIdByUsername = new Map<string, string>(
    users.map((u: { id: string; username: string }) => [u.username, u.id]),
  )
  const authorIds = AUTHORS.map((u) => userIdByUsername.get(u)).filter(
    (id): id is string => id !== undefined,
  )
  const voterIds = VOTERS.map((u) => userIdByUsername.get(u)).filter(
    (id): id is string => id !== undefined,
  )
  if (authorIds.length === 0) return

  const askReadIt = await db
    .selectFrom("community")
    .select("id")
    .where(sql`lower(name)`, "=", "askreadit")
    .executeTakeFirst()

  const topPosts = (await db
    .selectFrom("post")
    .select(["id"])
    .where("removedAt", "is", null)
    .orderBy(sql`ups - downs`, "desc")
    .limit(TARGET_POSTS)
    .execute()) as { id: string }[]
  if (topPosts.length === 0) return

  let deepChainPost: string | null = null
  if (askReadIt) {
    const askPosts = (await db
      .selectFrom("post")
      .select(["id"])
      .where("communityId", "=", askReadIt.id)
      .where("removedAt", "is", null)
      .orderBy(sql`ups - downs`, "desc")
      .limit(1)
      .execute()) as { id: string }[]
    deepChainPost = askPosts[0]?.id ?? null
  }

  const nodes: CommentNode[] = []
  const nodesById = new Map<string, CommentNode>()
  const register = (node: CommentNode): CommentNode => {
    nodes.push(node)
    nodesById.set(node.id, node)
    if (node.parentCommentId) {
      const parent = nodesById.get(node.parentCommentId)
      if (parent) parent.childCount += 1
    }
    return node
  }

  const randomAuthor = (): string => faker.helpers.arrayElement(authorIds)

  const grow = (node: CommentNode, budget: { left: number }, maxDepth: number): void => {
    if (budget.left <= 0 || node.depth >= maxDepth) return
    const replyChance = Math.max(0.1, 0.75 - node.depth * 0.12)
    const maxChildren =
      node.depth === 0 ? faker.number.int({ min: 0, max: 5 }) : faker.number.int({ min: 0, max: 3 })
    for (let i = 0; i < maxChildren; i++) {
      if (budget.left <= 0) return
      if (faker.number.float({ min: 0, max: 1 }) > replyChance) continue
      const child = register(makeNode(node.postId, node, randomAuthor()))
      budget.left -= 1
      grow(child, budget, maxDepth)
    }
  }

  const TARGET_TOTAL = 600
  const perPost = Math.max(4, Math.floor(TARGET_TOTAL / topPosts.length))
  for (const post of topPosts) {
    const budget = { left: perPost }
    const topLevel = faker.number.int({ min: 2, max: 6 })
    for (let i = 0; i < topLevel && budget.left > 0; i++) {
      const root = register(makeNode(post.id, null, randomAuthor()))
      budget.left -= 1
      grow(root, budget, 6)
    }
  }

  if (deepChainPost) {
    let parent: CommentNode | null = null
    for (let d = 0; d <= 15; d++) {
      parent = register(makeNode(deepChainPost, parent, randomAuthor()))
    }
  }

  const scrubbable = nodes.filter((n) => n.childCount > 0 && n.depth <= 3)
  for (const node of faker.helpers.arrayElements(scrubbable, Math.min(4, scrubbable.length))) {
    node.isDeleted = true
    node.authorUserId = null
    node.bodyMd = null
  }

  const rows = nodes
    .toSorted((a, b) => a.depth - b.depth)
    .map((n) => ({
      id: n.id,
      postId: n.postId,
      parentCommentId: n.parentCommentId,
      path: n.path,
      depth: n.depth,
      authorUserId: n.authorUserId,
      bodyMd: n.bodyMd,
      ups: n.ups,
      downs: n.downs,
      childCount: n.childCount,
      isDeleted: n.isDeleted,
      createdAt: n.createdAt,
    }))

  for (let i = 0; i < rows.length; i += 100) {
    await db
      .insertInto("comment")
      .values(rows.slice(i, i + 100))
      .execute()
  }

  const voteRows: { commentId: string; userId: string; value: number }[] = []
  for (const node of nodes) {
    if (node.isDeleted) continue
    if (faker.number.float({ min: 0, max: 1 }) > 0.3) continue
    const voters = faker.helpers.arrayElements(voterIds, faker.number.int({ min: 1, max: 3 }))
    for (const userId of voters) {
      voteRows.push({
        commentId: node.id,
        userId,
        value: faker.number.float({ min: 0, max: 1 }) < 0.85 ? 1 : -1,
      })
    }
  }
  for (let i = 0; i < voteRows.length; i += 200) {
    await db
      .insertInto("commentVote")
      .values(voteRows.slice(i, i + 200))
      .execute()
  }

  const countByPost = new Map<string, number>()
  for (const node of nodes) {
    countByPost.set(node.postId, (countByPost.get(node.postId) ?? 0) + 1)
  }
  for (const [postId, count] of countByPost) {
    await db.updateTable("post").set({ commentCount: count }).where("id", "=", postId).execute()
  }

  const karmaByUser = new Map<string, number>()
  for (const node of nodes) {
    if (!node.authorUserId) continue
    karmaByUser.set(
      node.authorUserId,
      (karmaByUser.get(node.authorUserId) ?? 0) + node.ups - node.downs,
    )
  }
  for (const [userId, karma] of karmaByUser) {
    await db.updateTable("user").set({ commentKarma: karma }).where("id", "=", userId).execute()
  }
}
