import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable, Updateable } from "kysely"
import { v7 } from "uuid"

interface CreateCommunityInput {
  name: string
  displayName?: string | null
  description: string
  visibility?: string
  isNsfw?: boolean
  topicId?: string | null
  iconImageKey?: string | null
  bannerImageKey?: string | null
  defaultCommentSort?: string
  createdByUserId: string
}

export function crudCommunity(db: Kysely<DB>) {
  async function create(input: CreateCommunityInput): Promise<Selectable<DB["community"]>> {
    const communityId = v7()
    return await db.transaction().execute(async (trx) => {
      const community = await trx
        .insertInto("community")
        .values({
          id: communityId,
          name: input.name,
          displayName: input.displayName ?? null,
          description: input.description,
          visibility: input.visibility ?? "public",
          isNsfw: input.isNsfw ?? false,
          topicId: input.topicId ?? null,
          iconImageKey: input.iconImageKey ?? null,
          bannerImageKey: input.bannerImageKey ?? null,
          defaultCommentSort: input.defaultCommentSort ?? "best",
          createdByUserId: input.createdByUserId,
          memberCount: 1,
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      await trx
        .insertInto("communityMember")
        .values({ id: v7(), communityId, userId: input.createdByUserId })
        .execute()

      await trx
        .insertInto("communityModerator")
        .values({
          id: v7(),
          communityId,
          userId: input.createdByUserId,
          position: 0,
          permEverything: true,
        })
        .execute()

      return community
    })
  }

  async function update(
    id: string,
    data: Updateable<DB["community"]>,
  ): Promise<Selectable<DB["community"]> | undefined> {
    return await db
      .updateTable("community")
      .set(data)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst()
  }

  return { create, update }
}
