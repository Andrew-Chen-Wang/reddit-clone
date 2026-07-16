import { fetchChatConversation } from "@lib/dao/chatConversation/fetch"
import { crudChatConversation } from "@lib/dao/chatConversation/crud"
import { crudChatMessage } from "@lib/dao/chatMessage/crud"
import { fetchChatMessage } from "@lib/dao/chatMessage/fetch"
import { crudChatParticipant } from "@lib/dao/chatParticipant/crud"
import { fetchChatParticipant } from "@lib/dao/chatParticipant/fetch"
import { crudModmailConversation } from "@lib/dao/modmailConversation/crud"
import { fetchModmailMessage } from "@lib/dao/modmailMessage/fetch"
import { crudModmailMessage } from "@lib/dao/modmailMessage/crud"
import { crudUserBlock } from "@lib/dao/userBlock/crud"
import { fetchUserBlock } from "@lib/dao/userBlock/fetch"
import { db } from "@template-nextjs/db"
import { v7 } from "uuid"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const suffix = v7().slice(0, 8)
const alice = v7()
const bob = v7()
const carol = v7()
const communityId = v7()

beforeAll(async () => {
  await db
    .insertInto("user")
    .values(
      [alice, bob, carol].map((id, i) => ({
        id,
        username: `chat-${suffix}-${i}`,
        email: `chat-${suffix}-${i}@example.invalid`,
      })),
    )
    .execute()

  await db
    .insertInto("userSettings")
    .values({ userId: carol, chatRequestPolicy: "nobody" })
    .execute()

  await db
    .insertInto("community")
    .values({
      id: communityId,
      name: `chattest${suffix}`,
      description: "chat test",
      visibility: "public",
      memberCount: 0,
      createdByUserId: alice,
    })
    .execute()
})

afterAll(async () => {
  await db.deleteFrom("modmailConversation").where("communityId", "=", communityId).execute()
  await db
    .deleteFrom("chatConversation")
    .where("createdByUserId", "in", [alice, bob, carol])
    .execute()
  await db.deleteFrom("community").where("id", "=", communityId).execute()
  await db.deleteFrom("user").where("id", "in", [alice, bob, carol]).execute()
  await db.destroy()
})

describe("chat DM create-or-get + request flow", () => {
  it("creates a DM with a pending recipient, reuses it, and accepts", async () => {
    const conversation = await crudChatConversation(db).create({
      isGroup: false,
      createdByUserId: alice,
    })
    await crudChatParticipant(db).createMany([
      { conversationId: conversation.id, userId: alice, role: "member", status: "accepted" },
      { conversationId: conversation.id, userId: bob, role: "member", status: "pending" },
    ])

    const found = await fetchChatConversation(db).findExistingDm(alice, bob)
    expect(found).toBe(conversation.id)
    const foundReverse = await fetchChatConversation(db).findExistingDm(bob, alice)
    expect(foundReverse).toBe(conversation.id)

    const bobParticipant = await fetchChatParticipant(db).getOne(conversation.id, bob, ["status"])
    expect(bobParticipant?.status).toBe("pending")

    const requests = await fetchChatConversation(db).listForUser(bob, "requests")
    expect(requests.map((r) => r.id)).toContain(conversation.id)

    await crudChatParticipant(db).setStatus(conversation.id, bob, "accepted")
    const accepted = await fetchChatParticipant(db).getOne(conversation.id, bob, ["status"])
    expect(accepted?.status).toBe("accepted")

    const stillRequests = await fetchChatConversation(db).listForUser(bob, "requests")
    expect(stillRequests.map((r) => r.id)).not.toContain(conversation.id)
    const all = await fetchChatConversation(db).listForUser(bob, "all")
    expect(all.map((r) => r.id)).toContain(conversation.id)
  })
})

describe("chat blocks and request policy", () => {
  it("reports a block between either direction and a nobody policy", async () => {
    await crudUserBlock(db).block(bob, carol)
    expect(await fetchUserBlock(db).isBlockedEither(carol, bob)).toBe(true)
    expect(await fetchUserBlock(db).isBlockedEither(bob, carol)).toBe(true)

    const settings = await db
      .selectFrom("userSettings")
      .select("chatRequestPolicy")
      .where("userId", "=", carol)
      .executeTakeFirst()
    expect(settings?.chatRequestPolicy).toBe("nobody")

    await crudUserBlock(db).unblock(bob, carol)
  })
})

describe("chat polling and unread counts", () => {
  it("returns only newer messages after a cursor and tracks unread", async () => {
    const conversation = await crudChatConversation(db).create({
      isGroup: false,
      createdByUserId: alice,
    })
    await crudChatParticipant(db).createMany([
      { conversationId: conversation.id, userId: alice, role: "member", status: "accepted" },
      { conversationId: conversation.id, userId: bob, role: "member", status: "accepted" },
    ])

    const base = Date.now()
    const messageIds: string[] = []
    for (let i = 0; i < 5; i++) {
      const m = await crudChatMessage(db).create({
        conversationId: conversation.id,
        senderUserId: bob,
        body: `msg ${i}`,
        createdAt: new Date(base + i * 1000),
      })
      messageIds.push(m.id)
    }

    const anchor = await fetchChatMessage(db).getOne(messageIds[1], ["createdAt"])
    const newer = await fetchChatMessage(db).listAfter(
      conversation.id,
      // biome-ignore lint/style/noNonNullAssertion: anchor is guaranteed to exist
      anchor!.createdAt,
      messageIds[1],
    )
    expect(newer.map((m) => m.id)).toEqual([messageIds[2], messageIds[3], messageIds[4]])

    const unreadBefore = await fetchChatConversation(db).unreadCounts(alice, [conversation.id])
    expect(unreadBefore.get(conversation.id)).toBe(5)

    await crudChatParticipant(db).markRead(conversation.id, alice, new Date(base + 10_000))
    const unreadAfter = await fetchChatConversation(db).unreadCounts(alice, [conversation.id])
    expect(unreadAfter.get(conversation.id) ?? 0).toBe(0)

    const globalUnread = await fetchChatConversation(db).countUnreadConversations(alice)
    expect(globalUnread).toBe(0)
  })
})

describe("modmail internal notes", () => {
  it("hides internal notes from the participant but shows them to mods", async () => {
    const conversation = await crudModmailConversation(db).create({
      communityId,
      subject: "test subject",
      participantUserId: bob,
      folder: "new",
    })
    await crudModmailMessage(db).create({
      conversationId: conversation.id,
      authorUserId: bob,
      bodyMd: "user message",
      isInternalNote: false,
    })
    await crudModmailMessage(db).create({
      conversationId: conversation.id,
      authorUserId: alice,
      bodyMd: "internal note",
      isInternalNote: true,
    })

    const participantView = await fetchModmailMessage(db).listForConversation(
      conversation.id,
      false,
    )
    expect(participantView).toHaveLength(1)
    expect(participantView[0].isInternalNote).toBe(false)

    const modView = await fetchModmailMessage(db).listForConversation(conversation.id, true)
    expect(modView).toHaveLength(2)
    expect(modView.some((m) => m.isInternalNote)).toBe(true)
  })
})
