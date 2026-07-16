import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

export function fetchCommunityUserFlair(db: Kysely<DB>) {
  async function getOne<T extends (keyof DB["communityUserFlair"])[]>(
    communityId: string,
    userId: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["communityUserFlair"]>, T[number]> | undefined> {
    return await db
      .selectFrom("communityUserFlair")
      .select(fields)
      .where("communityId", "=", communityId)
      .where("userId", "=", userId)
      .executeTakeFirst()
  }

  async function getResolvedForUser(
    communityId: string,
    userId: string,
  ): Promise<{
    templateId: string | null
    text: string
    bgColor: string | null
    textColor: string | null
  } | null> {
    const row = await db
      .selectFrom("communityUserFlair")
      .leftJoin(
        "userFlairTemplate",
        "userFlairTemplate.id",
        "communityUserFlair.userFlairTemplateId",
      )
      .select([
        "communityUserFlair.userFlairTemplateId as templateId",
        "communityUserFlair.customText as customText",
        "userFlairTemplate.text as templateText",
        "userFlairTemplate.bgColor as bgColor",
        "userFlairTemplate.textColor as textColor",
      ])
      .where("communityUserFlair.communityId", "=", communityId)
      .where("communityUserFlair.userId", "=", userId)
      .executeTakeFirst()

    if (!row) return null
    const text = row.customText ?? row.templateText ?? ""
    if (text === "") return null
    return {
      templateId: row.templateId,
      text,
      bgColor: row.bgColor,
      textColor: row.textColor,
    }
  }

  return { getOne, getResolvedForUser }
}
