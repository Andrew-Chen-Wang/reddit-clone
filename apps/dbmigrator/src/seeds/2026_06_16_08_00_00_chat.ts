import { type Kysely, sql } from "kysely"
import { v7 } from "uuid"

const MINUTE = 60 * 1000

interface SeedUser {
  id: string
  username: string
}

export async function seed(db: Kysely<any>): Promise<void> {
  const existing = await db.selectFrom("chatConversation").select("id").limit(1).executeTakeFirst()
  if (existing) return

  const users = (await db.selectFrom("user").select(["id", "username"]).execute()) as SeedUser[]
  const byName = new Map<string, string>(users.map((u) => [u.username, u.id]))
  const alice = byName.get("alice")
  const bob = byName.get("bob")
  const carol = byName.get("carol")
  const dave = byName.get("dave")
  const frank = byName.get("frank")
  if (!alice || !bob || !carol || !dave || !frank) return

  const now = Date.now()

  // Direct message thread between alice and bob (10 messages, last few unread for alice).
  const dmId = v7()
  await db
    .insertInto("chatConversation")
    .values({
      id: dmId,
      isGroup: false,
      createdByUserId: alice,
      lastMessageAt: new Date(now - MINUTE),
    })
    .execute()
  const dmMessages = Array.from({ length: 10 }, (_, i) => ({
    id: v7(),
    conversationId: dmId,
    senderUserId: i % 2 === 0 ? alice : bob,
    body: `Message ${i + 1} in the alice/bob thread.`,
    createdAt: new Date(now - (10 - i) * MINUTE),
  }))
  await db.insertInto("chatMessage").values(dmMessages).execute()
  await db
    .insertInto("chatParticipant")
    .values([
      {
        id: v7(),
        conversationId: dmId,
        userId: alice,
        role: "member",
        status: "accepted",
        lastReadAt: new Date(now - 6 * MINUTE),
      },
      {
        id: v7(),
        conversationId: dmId,
        userId: bob,
        role: "member",
        status: "accepted",
        lastReadAt: new Date(now - MINUTE),
      },
    ])
    .execute()

  // Pending chat request from carol to alice.
  const requestId = v7()
  await db
    .insertInto("chatConversation")
    .values({
      id: requestId,
      isGroup: false,
      createdByUserId: carol,
      lastMessageAt: new Date(now - 30 * MINUTE),
    })
    .execute()
  await db
    .insertInto("chatMessage")
    .values([
      {
        id: v7(),
        conversationId: requestId,
        senderUserId: carol,
        body: "Hi alice, loved your post about seeded data!",
        createdAt: new Date(now - 30 * MINUTE),
      },
    ])
    .execute()
  await db
    .insertInto("chatParticipant")
    .values([
      { id: v7(), conversationId: requestId, userId: carol, role: "member", status: "accepted" },
      { id: v7(), conversationId: requestId, userId: alice, role: "member", status: "pending" },
    ])
    .execute()

  // Group chat hosted by alice with bob and dave.
  const groupId = v7()
  await db
    .insertInto("chatConversation")
    .values({
      id: groupId,
      isGroup: true,
      name: "Weekend Plans",
      createdByUserId: alice,
      lastMessageAt: new Date(now - 2 * MINUTE),
    })
    .execute()
  const groupSenders = [alice, bob, dave, alice, bob]
  const groupMessages = groupSenders.map((senderUserId, i) => ({
    id: v7(),
    conversationId: groupId,
    senderUserId,
    body: `Group message ${i + 1}.`,
    createdAt: new Date(now - (5 - i) * MINUTE),
  }))
  await db.insertInto("chatMessage").values(groupMessages).execute()
  await db
    .insertInto("chatParticipant")
    .values([
      { id: v7(), conversationId: groupId, userId: alice, role: "host", status: "accepted" },
      { id: v7(), conversationId: groupId, userId: bob, role: "member", status: "accepted" },
      { id: v7(), conversationId: groupId, userId: dave, role: "member", status: "accepted" },
    ])
    .execute()

  // Modmail thread from frank to the AskReadIt mods with one internal note.
  const askReadIt = await db
    .selectFrom("community")
    .select("id")
    .where(sql`lower(name)`, "=", "askreadit")
    .executeTakeFirst()
  if (askReadIt) {
    const modmailId = v7()
    await db
      .insertInto("modmailConversation")
      .values({
        id: modmailId,
        communityId: askReadIt.id,
        subject: "Question about the posting rules",
        participantUserId: frank,
        folder: "in_progress",
        lastMessageAt: new Date(now - 15 * MINUTE),
      })
      .execute()
    await db
      .insertInto("modmailMessage")
      .values([
        {
          id: v7(),
          conversationId: modmailId,
          authorUserId: frank,
          bodyMd: "Hi mods, can I cross-post from another community?",
          isInternalNote: false,
          createdAt: new Date(now - 20 * MINUTE),
        },
        {
          id: v7(),
          conversationId: modmailId,
          authorUserId: alice,
          bodyMd: "Internal note: frank is a regular, let's be welcoming.",
          isInternalNote: true,
          createdAt: new Date(now - 17 * MINUTE),
        },
        {
          id: v7(),
          conversationId: modmailId,
          authorUserId: alice,
          bodyMd: "Hi frank! Cross-posts are fine as long as they follow rule 3.",
          isInternalNote: false,
          createdAt: new Date(now - 15 * MINUTE),
        },
      ])
      .execute()
  }
}
