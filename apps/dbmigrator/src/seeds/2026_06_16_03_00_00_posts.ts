import { faker } from "@faker-js/faker"
import type { Kysely } from "kysely"
import { v7 } from "uuid"

// Seeded post_vote rows are a small illustrative subset and intentionally do not sum to each
// post's ups/downs — acceptable slack for dev data where the counters drive the feed math.

const AUTHORS = ["alice", "bob", "carol", "dave", "erin", "frank", "readit-admin"]
const VOTERS = ["alice", "bob", "carol", "dave", "erin", "frank", "readit-admin"]
const POSTS_PER_COMMUNITY = 22
const PROFILE_POST_COUNT = 6
const MINUTE = 60 * 1000
const DAY = 24 * 60 * MINUTE

interface PostInsert {
  id: string
  authorUserId: string
  communityId: string | null
  profileUserId: string | null
  type: string
  title: string
  bodyMd: string | null
  linkUrl: string | null
  isNsfw: boolean
  isSpoiler: boolean
  isOc: boolean
  isLocked: boolean
  stickyPosition: number | null
  flairTemplateId: string | null
  ups: number
  downs: number
  createdAt: Date
}

function skewedUps(): number {
  const roll = faker.number.float({ min: 0, max: 1 })
  if (roll < 0.05) return faker.number.int({ min: 500, max: 3000 })
  if (roll < 0.25) return faker.number.int({ min: 50, max: 500 })
  return faker.number.int({ min: 0, max: 50 })
}

function ageMs(): number {
  // 2 hours to 11 months old, log-skewed toward recent so every Top window differs
  const roll = faker.number.float({ min: 0, max: 1 })
  const maxMs = 330 * DAY
  const minMs = 2 * 60 * MINUTE
  return Math.round(minMs + roll * roll * (maxMs - minMs))
}

export async function seed(db: Kysely<any>): Promise<void> {
  const existing = await db.selectFrom("post").select("id").limit(1).executeTakeFirst()
  if (existing) return

  faker.seed(20260616)

  const users = await db.selectFrom("user").select(["id", "username"]).execute()
  const userIdByUsername = new Map<string, string>(
    users.map((u: { id: string; username: string }) => [u.username, u.id]),
  )

  const communities = await db.selectFrom("community").select(["id", "name"]).execute()
  const flairs = await db
    .selectFrom("postFlairTemplate")
    .select(["id", "communityId", "modOnly"])
    .execute()
  const flairsByCommunity = new Map<string, string[]>()
  for (const f of flairs as { id: string; communityId: string; modOnly: boolean }[]) {
    if (f.modOnly) continue
    const list = flairsByCommunity.get(f.communityId) ?? []
    list.push(f.id)
    flairsByCommunity.set(f.communityId, list)
  }

  const authorIds = AUTHORS.map((u) => userIdByUsername.get(u)).filter(
    (id): id is string => id !== undefined,
  )
  const now = Date.now()
  const posts: PostInsert[] = []

  for (const community of communities as { id: string; name: string }[]) {
    const communityFlairs = flairsByCommunity.get(community.id) ?? []
    for (let i = 0; i < POSTS_PER_COMMUNITY; i++) {
      const authorUserId = faker.helpers.arrayElement(authorIds)
      const isLink = faker.number.float({ min: 0, max: 1 }) < 0.3
      const ups = skewedUps()
      const controversial = faker.number.float({ min: 0, max: 1 }) < 0.15
      const downs = controversial
        ? faker.number.int({ min: Math.floor(ups * 0.6), max: ups + 5 })
        : faker.number.int({ min: 0, max: Math.floor(ups * 0.25) })

      posts.push({
        id: v7(),
        authorUserId,
        communityId: community.id,
        profileUserId: null,
        type: isLink ? "link" : "text",
        title: faker.lorem.sentence({ min: 4, max: 12 }).replace(/\.$/, ""),
        bodyMd: isLink ? null : faker.lorem.paragraphs({ min: 1, max: 3 }, "\n\n"),
        linkUrl: isLink ? faker.internet.url() : null,
        isNsfw: faker.number.float({ min: 0, max: 1 }) < 0.08,
        isSpoiler: faker.number.float({ min: 0, max: 1 }) < 0.08,
        isOc: faker.number.float({ min: 0, max: 1 }) < 0.15,
        isLocked: false,
        stickyPosition: null,
        flairTemplateId:
          communityFlairs.length > 0 && faker.number.float({ min: 0, max: 1 }) < 0.4
            ? faker.helpers.arrayElement(communityFlairs)
            : null,
        ups,
        downs,
        createdAt: new Date(now - ageMs()),
      })
    }
  }

  const askReadIt = (communities as { id: string; name: string }[]).find(
    (c) => c.name.toLowerCase() === "askreadit",
  )
  const aliceId = userIdByUsername.get("alice")
  if (askReadIt && aliceId) {
    for (let s = 0; s < 2; s++) {
      posts.push({
        id: v7(),
        authorUserId: aliceId,
        communityId: askReadIt.id,
        profileUserId: null,
        type: "text",
        title: s === 0 ? "Welcome to AskReadIt — read the rules first" : "Weekly discussion thread",
        bodyMd: faker.lorem.paragraphs({ min: 1, max: 2 }, "\n\n"),
        linkUrl: null,
        isNsfw: false,
        isSpoiler: false,
        isOc: false,
        isLocked: false,
        stickyPosition: s + 1,
        flairTemplateId: null,
        ups: faker.number.int({ min: 100, max: 800 }),
        downs: faker.number.int({ min: 0, max: 20 }),
        createdAt: new Date(now - faker.number.int({ min: 1, max: 5 }) * DAY),
      })
    }
  }

  let locked = 0
  for (const post of posts) {
    if (locked >= 2) break
    if (post.communityId !== null && post.stickyPosition === null) {
      post.isLocked = true
      locked++
    }
  }

  for (let i = 0; i < PROFILE_POST_COUNT; i++) {
    const authorUserId = faker.helpers.arrayElement(authorIds)
    const ups = faker.number.int({ min: 0, max: 120 })
    posts.push({
      id: v7(),
      authorUserId,
      communityId: null,
      profileUserId: authorUserId,
      type: "text",
      title: faker.lorem.sentence({ min: 4, max: 10 }).replace(/\.$/, ""),
      bodyMd: faker.lorem.paragraphs({ min: 1, max: 2 }, "\n\n"),
      linkUrl: null,
      isNsfw: false,
      isSpoiler: false,
      isOc: faker.number.float({ min: 0, max: 1 }) < 0.3,
      isLocked: false,
      stickyPosition: null,
      flairTemplateId: null,
      ups,
      downs: faker.number.int({ min: 0, max: Math.floor(ups * 0.2) }),
      createdAt: new Date(now - ageMs()),
    })
  }

  for (let i = 0; i < posts.length; i += 100) {
    await db
      .insertInto("post")
      .values(posts.slice(i, i + 100))
      .execute()
  }

  const voterIds = VOTERS.map((u) => userIdByUsername.get(u)).filter(
    (id): id is string => id !== undefined,
  )
  const voteRows: { postId: string; userId: string; value: number }[] = []
  for (const post of posts) {
    if (faker.number.float({ min: 0, max: 1 }) > 0.4) continue
    const voters = faker.helpers.arrayElements(voterIds, faker.number.int({ min: 1, max: 4 }))
    for (const userId of voters) {
      voteRows.push({
        postId: post.id,
        userId,
        value: faker.number.float({ min: 0, max: 1 }) < 0.85 ? 1 : -1,
      })
    }
  }
  for (let i = 0; i < voteRows.length; i += 200) {
    await db
      .insertInto("postVote")
      .values(voteRows.slice(i, i + 200))
      .onConflict((oc: any) => oc.columns(["postId", "userId"]).doNothing())
      .execute()
  }

  const karmaByUser = new Map<string, number>()
  for (const post of posts) {
    karmaByUser.set(
      post.authorUserId,
      (karmaByUser.get(post.authorUserId) ?? 0) + post.ups - post.downs,
    )
  }
  for (const [userId, karma] of karmaByUser) {
    await db.updateTable("user").set({ postKarma: karma }).where("id", "=", userId).execute()
  }

  // Bootstrap the rising serve table (bullground's rising-recompute job rewrites it on its cadence)
  const risingCutoff = now - DAY
  const rawRising = posts
    .filter((p) => p.communityId !== null && p.createdAt.getTime() >= risingCutoff)
    .map((p) => ({
      postId: p.id,
      communityId: p.communityId as string,
      raw: (p.ups - p.downs) / ((now - p.createdAt.getTime()) / MINUTE + 2),
    }))
  const maxByCommunity = new Map<string, number>()
  for (const r of rawRising) {
    maxByCommunity.set(r.communityId, Math.max(maxByCommunity.get(r.communityId) ?? 0, r.raw))
  }
  const risingRows = rawRising
    .filter((r) => (maxByCommunity.get(r.communityId) ?? 0) > 0)
    .map((r) => ({
      postId: r.postId,
      communityId: r.communityId,
      score: r.raw / (maxByCommunity.get(r.communityId) as number),
      computedAt: new Date(),
    }))
    .toSorted((a, b) => b.score - a.score)
    .slice(0, 200)
  if (risingRows.length > 0) {
    await db.insertInto("postRising").values(risingRows).execute()
  }
}
