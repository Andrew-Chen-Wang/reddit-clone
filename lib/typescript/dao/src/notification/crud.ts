import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"
import { v7 } from "uuid"
import { fetchUserBlock } from "../userBlock/fetch"
import { fetchUserNotificationPreference } from "../userNotificationPreference/fetch"
import type { NotificationType, PreviewSnapshot } from "./types"

interface EmitArgs {
  userId: string
  actorUserId?: string | null
  postId?: string | null
  commentId?: string | null
  communityId?: string | null
  conversationId?: string | null
  previewSnapshot?: PreviewSnapshot
}

export function crudNotification(db: Kysely<DB>) {
  async function emit(type: NotificationType, args: EmitArgs): Promise<{ id: string } | null> {
    const actorUserId = args.actorUserId ?? null

    if (actorUserId !== null && actorUserId === args.userId) return null

    if (actorUserId !== null) {
      if (await fetchUserBlock(db).isBlockedEither(args.userId, actorUserId)) return null
    }

    const level = await fetchUserNotificationPreference(db).getLevel(args.userId, type)
    if (level === "off") return null

    const id = v7()
    await db
      .insertInto("notification")
      .values({
        id,
        userId: args.userId,
        type,
        actorUserId,
        postId: args.postId ?? null,
        commentId: args.commentId ?? null,
        communityId: args.communityId ?? null,
        conversationId: args.conversationId ?? null,
        previewSnapshot: (args.previewSnapshot ?? null) as never,
      })
      .execute()
    return { id }
  }

  async function markRead(id: string, userId: string): Promise<void> {
    await db
      .updateTable("notification")
      .set({ readAt: new Date() })
      .where("id", "=", id)
      .where("userId", "=", userId)
      .where("readAt", "is", null)
      .execute()
  }

  async function markAllRead(userId: string): Promise<void> {
    await db
      .updateTable("notification")
      .set({ readAt: new Date() })
      .where("userId", "=", userId)
      .where("readAt", "is", null)
      .execute()
  }

  async function archive(id: string, userId: string): Promise<void> {
    await db
      .updateTable("notification")
      .set({ archivedAt: new Date() })
      .where("id", "=", id)
      .where("userId", "=", userId)
      .where("archivedAt", "is", null)
      .execute()
  }

  return { emit, markRead, markAllRead, archive }
}
