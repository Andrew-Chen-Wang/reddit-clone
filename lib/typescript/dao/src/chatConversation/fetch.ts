import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

export type ChatListFilter = "all" | "groups" | "dms" | "requests" | "unread"

export function fetchChatConversation(db: Kysely<DB>) {
  async function getOne<T extends (keyof DB["chatConversation"])[]>(
    id: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["chatConversation"]>, T[number]> | undefined> {
    return await db
      .selectFrom("chatConversation")
      .select(fields)
      .where("id", "=", id)
      .executeTakeFirst()
  }

  async function findExistingDm(userA: string, userB: string): Promise<string | undefined> {
    const row = await db
      .selectFrom("chatConversation as c")
      .innerJoin("chatParticipant as pa", (join) =>
        join.onRef("pa.conversationId", "=", "c.id").on("pa.userId", "=", userA),
      )
      .innerJoin("chatParticipant as pb", (join) =>
        join.onRef("pb.conversationId", "=", "c.id").on("pb.userId", "=", userB),
      )
      .where("c.isGroup", "=", false)
      .select("c.id as id")
      .limit(1)
      .executeTakeFirst()
    return row?.id
  }

  async function listForUser(userId: string, filter: ChatListFilter) {
    return await db
      .selectFrom("chatParticipant as me")
      .innerJoin("chatConversation as c", "c.id", "me.conversationId")
      .where("me.userId", "=", userId)
      .$if(filter === "requests", (qb) => qb.where("me.status", "=", "pending"))
      .$if(filter !== "requests", (qb) =>
        qb
          .where("me.status", "=", "accepted")
          .where((eb) =>
            eb.or([
              eb("me.hiddenAt", "is", null),
              eb(eb.ref("c.lastMessageAt"), ">", eb.ref("me.hiddenAt")),
            ]),
          ),
      )
      .$if(filter === "groups", (qb) => qb.where("c.isGroup", "=", true))
      .$if(filter === "dms", (qb) => qb.where("c.isGroup", "=", false))
      .select([
        "c.id as id",
        "c.isGroup as isGroup",
        "c.name as name",
        "c.createdByUserId as createdByUserId",
        "c.lastMessageAt as lastMessageAt",
        "c.createdAt as createdAt",
        "me.status as myStatus",
        "me.role as myRole",
        "me.lastReadAt as lastReadAt",
        "me.hiddenAt as hiddenAt",
      ])
      .orderBy("c.lastMessageAt", "desc")
      .execute()
  }

  async function listParticipants(conversationIds: string[]) {
    if (conversationIds.length === 0) return []
    return await db
      .selectFrom("chatParticipant as p")
      .innerJoin("user as u", "u.id", "p.userId")
      .where("p.conversationId", "in", conversationIds)
      .select([
        "p.conversationId as conversationId",
        "p.userId as userId",
        "p.role as role",
        "p.status as status",
        "u.username as username",
        "u.displayName as displayName",
        "u.avatarImageKey as avatarImageKey",
      ])
      .execute()
  }

  async function lastMessages(conversationIds: string[]) {
    if (conversationIds.length === 0) return []
    return await db
      .selectFrom("chatMessage as m")
      .where("m.conversationId", "in", conversationIds)
      .distinctOn("m.conversationId")
      .orderBy("m.conversationId")
      .orderBy("m.createdAt", "desc")
      .orderBy("m.id", "desc")
      .select([
        "m.conversationId as conversationId",
        "m.id as id",
        "m.body as body",
        "m.senderUserId as senderUserId",
        "m.createdAt as createdAt",
        "m.deletedAt as deletedAt",
      ])
      .execute()
  }

  async function unreadCounts(
    userId: string,
    conversationIds: string[],
  ): Promise<Map<string, number>> {
    if (conversationIds.length === 0) return new Map()
    const rows = await db
      .selectFrom("chatParticipant as me")
      .innerJoin("chatMessage as m", "m.conversationId", "me.conversationId")
      .where("me.userId", "=", userId)
      .where("me.conversationId", "in", conversationIds)
      .where("m.deletedAt", "is", null)
      .where((eb) =>
        eb.or([
          eb("me.lastReadAt", "is", null),
          eb(eb.ref("m.createdAt"), ">", eb.ref("me.lastReadAt")),
        ]),
      )
      .where((eb) =>
        eb.or([
          eb("m.senderUserId", "is", null),
          eb(eb.ref("m.senderUserId"), "<>", eb.ref("me.userId")),
        ]),
      )
      .groupBy("me.conversationId")
      .select((eb) => ["me.conversationId as conversationId", eb.fn.countAll<string>().as("count")])
      .execute()
    return new Map(rows.map((r) => [r.conversationId, Number(r.count)]))
  }

  async function countUnreadConversations(userId: string): Promise<number> {
    const row = await db
      .selectFrom("chatParticipant as me")
      .innerJoin("chatMessage as m", "m.conversationId", "me.conversationId")
      .where("me.userId", "=", userId)
      .where("me.status", "=", "accepted")
      .where("m.deletedAt", "is", null)
      .where((eb) =>
        eb.or([
          eb("me.lastReadAt", "is", null),
          eb(eb.ref("m.createdAt"), ">", eb.ref("me.lastReadAt")),
        ]),
      )
      .where((eb) =>
        eb.or([
          eb("me.hiddenAt", "is", null),
          eb(eb.ref("m.createdAt"), ">", eb.ref("me.hiddenAt")),
        ]),
      )
      .where((eb) =>
        eb.or([
          eb("m.senderUserId", "is", null),
          eb(eb.ref("m.senderUserId"), "<>", eb.ref("me.userId")),
        ]),
      )
      .select((eb) => eb.fn.count("me.conversationId").distinct().as("count"))
      .executeTakeFirstOrThrow()
    return Number(row.count)
  }

  return {
    getOne,
    findExistingDm,
    listForUser,
    listParticipants,
    lastMessages,
    unreadCounts,
    countUnreadConversations,
  }
}
