import type { Kysely } from "kysely"
import { v7 } from "uuid"

interface RuleDef {
  name: string
  description: string
}

interface FlairDef {
  text: string
  bgColor: string
  textColor: string
}

interface CommunityDef {
  name: string
  displayName: string
  description: string
  topicName: string
  visibility: "public" | "restricted" | "private"
  isNsfw: boolean
  creator: string
  members: string[]
  rules: RuleDef[]
  postFlair: FlairDef[]
  userFlair: FlairDef[]
}

const COMMUNITIES: CommunityDef[] = [
  {
    name: "AskReadIt",
    displayName: "Ask ReadIt",
    description: "The place to ask and answer thought-provoking questions.",
    topicName: "Q&As & Stories",
    visibility: "public",
    isNsfw: false,
    creator: "alice",
    members: ["bob", "carol", "dave", "erin", "frank"],
    rules: [
      { name: "Be respectful", description: "Treat others as you'd like to be treated." },
      { name: "No loaded questions", description: "Ask in good faith, not to push an agenda." },
      { name: "Search before posting", description: "Your question may already be answered." },
    ],
    postFlair: [],
    userFlair: [],
  },
  {
    name: "programming",
    displayName: "Programming",
    description: "Computer programming news, discussion, and questions.",
    topicName: "Technology",
    visibility: "public",
    isNsfw: false,
    creator: "bob",
    members: ["alice", "carol", "dave", "frank"],
    rules: [
      {
        name: "Keep it about programming",
        description: "Posts should relate to writing software.",
      },
      { name: "No low-effort content", description: "Memes and screenshots belong elsewhere." },
    ],
    postFlair: [
      { text: "Discussion", bgColor: "#0079d3", textColor: "#ffffff" },
      { text: "Help", bgColor: "#46a508", textColor: "#ffffff" },
      { text: "Show & Tell", bgColor: "#7e53c1", textColor: "#ffffff" },
    ],
    userFlair: [{ text: "Rustacean", bgColor: "#ce422b", textColor: "#ffffff" }],
  },
  {
    name: "worldnews",
    displayName: "World News",
    description: "Major news from around the world, excluding US-internal stories.",
    topicName: "News & Politics",
    visibility: "public",
    isNsfw: false,
    creator: "carol",
    members: ["alice", "bob", "erin"],
    rules: [],
    postFlair: [],
    userFlair: [],
  },
  {
    name: "gaming",
    displayName: "Gaming",
    description: "A subreddit for (almost) anything related to games.",
    topicName: "Games",
    visibility: "public",
    isNsfw: false,
    creator: "dave",
    members: ["alice", "bob", "carol", "erin", "frank"],
    rules: [
      { name: "No self-promotion", description: "Do not spam your own channels or products." },
      { name: "Tag spoilers", description: "Use spoiler tags for recent releases." },
    ],
    postFlair: [
      { text: "News", bgColor: "#ea0027", textColor: "#ffffff" },
      { text: "Discussion", bgColor: "#0079d3", textColor: "#ffffff" },
      { text: "Clip", bgColor: "#ff4500", textColor: "#ffffff" },
    ],
    userFlair: [{ text: "PC Master Race", bgColor: "#1a1a1b", textColor: "#ffffff" }],
  },
  {
    name: "cooking",
    displayName: "Cooking",
    description: "For the cooks of ReadIt and those who want to learn how to cook.",
    topicName: "Food & Drinks",
    visibility: "public",
    isNsfw: false,
    creator: "erin",
    members: ["alice", "carol"],
    rules: [],
    postFlair: [],
    userFlair: [],
  },
  {
    name: "movies",
    displayName: "Movies",
    description: "News and discussion about major motion pictures.",
    topicName: "Movies & TV",
    visibility: "restricted",
    isNsfw: false,
    creator: "alice",
    members: ["bob", "carol"],
    rules: [
      { name: "No piracy", description: "Do not link to or request illegal streams." },
      { name: "Spoilers in titles are banned", description: "Keep spoilers out of post titles." },
    ],
    postFlair: [],
    userFlair: [],
  },
  {
    name: "fitness",
    displayName: "Fitness",
    description: "The place for all things about physical fitness and nutrition.",
    topicName: "Health",
    visibility: "public",
    isNsfw: false,
    creator: "frank",
    members: ["alice", "dave"],
    rules: [],
    postFlair: [],
    userFlair: [],
  },
  {
    name: "travel",
    displayName: "Travel",
    description: "A community for travel tips, stories, and photos from around the world.",
    topicName: "Places & Travel",
    visibility: "public",
    isNsfw: false,
    creator: "alice",
    members: ["carol", "erin", "frank"],
    rules: [],
    postFlair: [],
    userFlair: [],
  },
  {
    name: "music",
    displayName: "Music",
    description: "The musical community of ReadIt.",
    topicName: "Music",
    visibility: "public",
    isNsfw: false,
    creator: "carol",
    members: ["alice", "dave", "erin"],
    rules: [],
    postFlair: [],
    userFlair: [],
  },
  {
    name: "NextBestFit",
    displayName: "Next Best Fit",
    description: "A private community for the NextBestFit team.",
    topicName: "Technology",
    visibility: "private",
    isNsfw: false,
    creator: "alice",
    members: ["bob"],
    rules: [{ name: "Keep it internal", description: "Do not share anything outside the team." }],
    postFlair: [],
    userFlair: [],
  },
]

export async function seed(db: Kysely<any>): Promise<void> {
  const users = await db.selectFrom("user").select(["id", "username"]).execute()
  const userIdByUsername = new Map<string, string>(
    users.map((u: { id: string; username: string }) => [u.username, u.id]),
  )

  const topics = await db.selectFrom("topic").select(["id", "name"]).execute()
  const topicIdByName = new Map<string, string>(
    topics.map((t: { id: string; name: string }) => [t.name, t.id]),
  )

  const existing = await db.selectFrom("community").select(["name"]).execute()
  const existingNames = new Set<string>(
    existing.map((row: { name: string }) => row.name.toLowerCase()),
  )

  for (const def of COMMUNITIES) {
    if (existingNames.has(def.name.toLowerCase())) continue

    const creatorId = userIdByUsername.get(def.creator)
    const topicId = topicIdByName.get(def.topicName) ?? null
    if (!creatorId) continue

    const memberUsernames = [def.creator, ...def.members.filter((m) => m !== def.creator)]
    const memberIds = memberUsernames
      .map((username) => userIdByUsername.get(username))
      .filter((id): id is string => id !== undefined)

    const communityId = v7()

    await db
      .insertInto("community")
      .values({
        id: communityId,
        name: def.name,
        displayName: def.displayName,
        description: def.description,
        visibility: def.visibility,
        isNsfw: def.isNsfw,
        topicId,
        memberCount: memberIds.length,
        defaultCommentSort: "best",
        createdByUserId: creatorId,
      })
      .execute()

    await db
      .insertInto("communityMember")
      .values(
        memberIds.map((userId, index) => ({
          id: v7(),
          communityId,
          userId,
          isFavorite: userId === creatorId && index === 0,
          notificationLevel: "low",
        })),
      )
      .onConflict((oc) => oc.columns(["communityId", "userId"]).doNothing())
      .execute()

    await db
      .insertInto("communityModerator")
      .values({
        id: v7(),
        communityId,
        userId: creatorId,
        position: 0,
        permEverything: true,
      })
      .onConflict((oc) => oc.columns(["communityId", "userId"]).doNothing())
      .execute()

    if (def.rules.length > 0) {
      await db
        .insertInto("communityRule")
        .values(
          def.rules.map((rule, index) => ({
            id: v7(),
            communityId,
            position: index,
            name: rule.name,
            description: rule.description,
          })),
        )
        .execute()
    }

    if (def.postFlair.length > 0) {
      await db
        .insertInto("postFlairTemplate")
        .values(
          def.postFlair.map((flair, index) => ({
            id: v7(),
            communityId,
            text: flair.text,
            bgColor: flair.bgColor,
            textColor: flair.textColor,
            position: index,
          })),
        )
        .execute()
    }

    if (def.userFlair.length > 0) {
      await db
        .insertInto("userFlairTemplate")
        .values(
          def.userFlair.map((flair, index) => ({
            id: v7(),
            communityId,
            text: flair.text,
            bgColor: flair.bgColor,
            textColor: flair.textColor,
            selfAssignable: true,
            position: index,
          })),
        )
        .execute()
    }
  }
}
