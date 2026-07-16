import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

export function fetchModmailConversation(db: Kysely<DB>) {
  async function getOne<T extends (keyof DB["modmailConversation"])[]>(
    id: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["modmailConversation"]>, T[number]> | undefined> {
    return await db
      .selectFrom("modmailConversation")
      .select(fields)
      .where("id", "=", id)
      .executeTakeFirst()
  }

  async function listForParticipant(userId: string) {
    return await db
      .selectFrom("modmailConversation as mc")
      .innerJoin("community as c", "c.id", "mc.communityId")
      .where("mc.participantUserId", "=", userId)
      .select([
        "mc.id as id",
        "mc.subject as subject",
        "mc.folder as folder",
        "mc.isHighlighted as isHighlighted",
        "mc.communityId as communityId",
        "mc.participantUserId as participantUserId",
        "mc.lastMessageAt as lastMessageAt",
        "mc.createdAt as createdAt",
        "c.name as communityName",
        "c.iconImageKey as communityIconImageKey",
      ])
      .orderBy("mc.lastMessageAt", "desc")
      .execute()
  }

  async function listForCommunities(communityIds: string[], folder: string | null) {
    if (communityIds.length === 0) return []
    return await db
      .selectFrom("modmailConversation as mc")
      .innerJoin("community as c", "c.id", "mc.communityId")
      .innerJoin("user as u", "u.id", "mc.participantUserId")
      .where("mc.communityId", "in", communityIds)
      .$if(folder !== null, (qb) => qb.where("mc.folder", "=", folder!))
      .select([
        "mc.id as id",
        "mc.subject as subject",
        "mc.folder as folder",
        "mc.isHighlighted as isHighlighted",
        "mc.communityId as communityId",
        "mc.participantUserId as participantUserId",
        "mc.lastMessageAt as lastMessageAt",
        "mc.createdAt as createdAt",
        "c.name as communityName",
        "c.iconImageKey as communityIconImageKey",
        "u.username as participantUsername",
        "u.avatarImageKey as participantAvatarImageKey",
      ])
      .orderBy("mc.isHighlighted", "desc")
      .orderBy("mc.lastMessageAt", "desc")
      .execute()
  }

  return { getOne, listForParticipant, listForCommunities }
}
