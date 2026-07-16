import type { DB } from "@template-nextjs/db"
import { type Kysely, type Selectable, sql } from "kysely"
import { v7 } from "uuid"

interface CreatePostInput {
  id?: string
  authorUserId: string
  communityId?: string | null
  profileUserId?: string | null
  type: string
  title: string
  bodyMd?: string | null
  linkUrl?: string | null
  isNsfw?: boolean
  isSpoiler?: boolean
  isOc?: boolean
  isLocked?: boolean
  stickyPosition?: number | null
  flairTemplateId?: string | null
  crosspostOfPostId?: string | null
  ups?: number
  downs?: number
}

interface UpdatePostInput {
  bodyMd?: string
  title?: string
  isNsfw?: boolean
  isSpoiler?: boolean
  isOc?: boolean
  flairTemplateId?: string | null
}

export function crudPost(db: Kysely<DB>) {
  async function create(input: CreatePostInput): Promise<Selectable<DB["post"]>> {
    const id = input.id ?? v7()
    return await db.transaction().execute(async (trx) => {
      const post = await trx
        .insertInto("post")
        .values({
          id,
          authorUserId: input.authorUserId,
          communityId: input.communityId ?? null,
          profileUserId: input.profileUserId ?? null,
          type: input.type,
          title: input.title,
          bodyMd: input.bodyMd ?? null,
          linkUrl: input.linkUrl ?? null,
          isNsfw: input.isNsfw ?? false,
          isSpoiler: input.isSpoiler ?? false,
          isOc: input.isOc ?? false,
          isLocked: input.isLocked ?? false,
          stickyPosition: input.stickyPosition ?? null,
          flairTemplateId: input.flairTemplateId ?? null,
          crosspostOfPostId: input.crosspostOfPostId ?? null,
          ups: input.ups ?? 0,
          downs: input.downs ?? 0,
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      if (input.communityId) {
        await trx
          .insertInto("communityVisit")
          .values({
            communityId: input.communityId,
            userId: input.authorUserId,
            lastVisitedAt: new Date(),
          })
          .onConflict((oc) =>
            oc.columns(["userId", "communityId"]).doUpdateSet({ lastVisitedAt: new Date() }),
          )
          .execute()
      }

      return post
    })
  }

  async function update(
    id: string,
    authorUserId: string,
    patch: UpdatePostInput,
  ): Promise<Selectable<DB["post"]> | undefined> {
    const set: Record<string, unknown> = {}
    if (patch.bodyMd !== undefined) {
      set.bodyMd = patch.bodyMd
      set.editedAt = new Date()
    }
    if (patch.title !== undefined) set.title = patch.title
    if (patch.isNsfw !== undefined) set.isNsfw = patch.isNsfw
    if (patch.isSpoiler !== undefined) set.isSpoiler = patch.isSpoiler
    if (patch.isOc !== undefined) set.isOc = patch.isOc
    if (patch.flairTemplateId !== undefined) set.flairTemplateId = patch.flairTemplateId
    if (Object.keys(set).length === 0) {
      return await db
        .selectFrom("post")
        .selectAll()
        .where("id", "=", id)
        .where("authorUserId", "=", authorUserId)
        .executeTakeFirst()
    }
    return await db
      .updateTable("post")
      .set(set)
      .where("id", "=", id)
      .where("authorUserId", "=", authorUserId)
      .returningAll()
      .executeTakeFirst()
  }

  async function deleteOwn(id: string, authorUserId: string): Promise<boolean> {
    const result = await db
      .deleteFrom("post")
      .where("id", "=", id)
      .where("authorUserId", "=", authorUserId)
      .executeTakeFirst()
    return (result.numDeletedRows ?? 0n) > 0n
  }

  async function deleteById(id: string): Promise<boolean> {
    const result = await db.deleteFrom("post").where("id", "=", id).executeTakeFirst()
    return (result.numDeletedRows ?? 0n) > 0n
  }

  async function setFlair(
    id: string,
    authorUserId: string,
    flairTemplateId: string | null,
  ): Promise<void> {
    await db
      .updateTable("post")
      .set({ flairTemplateId })
      .where("id", "=", id)
      .where("authorUserId", "=", authorUserId)
      .execute()
  }

  async function incrementShareCount(id: string): Promise<void> {
    await db
      .updateTable("post")
      .set((eb) => ({ shareCount: eb("shareCount", "+", 1) }))
      .where("id", "=", id)
      .execute()
  }

  async function incrementViewCount(id: string): Promise<void> {
    await db
      .updateTable("post")
      .set({ viewCount: sql`${sql.ref("viewCount")} + 1` })
      .where("id", "=", id)
      .execute()
  }

  return {
    create,
    update,
    deleteOwn,
    deleteById,
    setFlair,
    incrementShareCount,
    incrementViewCount,
  }
}
