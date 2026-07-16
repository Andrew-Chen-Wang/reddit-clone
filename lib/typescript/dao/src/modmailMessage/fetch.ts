import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export function fetchModmailMessage(db: Kysely<DB>) {
  async function listForConversation(conversationId: string, includeInternal: boolean) {
    return await db
      .selectFrom("modmailMessage as m")
      .leftJoin("user as u", "u.id", "m.authorUserId")
      .where("m.conversationId", "=", conversationId)
      .$if(!includeInternal, (qb) => qb.where("m.isInternalNote", "=", false))
      .select([
        "m.id as id",
        "m.conversationId as conversationId",
        "m.authorUserId as authorUserId",
        "m.bodyMd as bodyMd",
        "m.isInternalNote as isInternalNote",
        "m.createdAt as createdAt",
        "u.username as authorUsername",
        "u.avatarImageKey as authorAvatarImageKey",
      ])
      .orderBy("m.createdAt", "asc")
      .orderBy("m.id", "asc")
      .execute()
  }

  return { listForConversation }
}
