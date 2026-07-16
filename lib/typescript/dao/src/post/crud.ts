import type { DB } from "@template-nextjs/db"
import { type Kysely, type Selectable, sql } from "kysely"
import { v7 } from "uuid"

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50)
    .replace(/-$/g, "")
}

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
          slug: slugifyTitle(input.title),
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

  async function setLinkImageKey(id: string, linkImageKey: string | null): Promise<void> {
    await db.updateTable("post").set({ linkImageKey }).where("id", "=", id).execute()
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

  async function modRemove(
    id: string,
    removedByUserId: string,
    removalReasonId: string | null,
    asSpam: boolean,
  ): Promise<boolean> {
    const result = await db
      .updateTable("post")
      .set({
        removedAt: new Date(),
        removedByUserId,
        removalReasonId,
        isSpam: asSpam,
        approvedAt: null,
        approvedByUserId: null,
      })
      .where("id", "=", id)
      .executeTakeFirst()
    return (result.numUpdatedRows ?? 0n) > 0n
  }

  async function hold(id: string): Promise<void> {
    await db
      .updateTable("post")
      .set({ removedAt: new Date(), removedByUserId: null, isSpam: false })
      .where("id", "=", id)
      .execute()
  }

  async function modApprove(id: string, approvedByUserId: string): Promise<boolean> {
    const result = await db
      .updateTable("post")
      .set({
        removedAt: null,
        removedByUserId: null,
        removalReasonId: null,
        isSpam: false,
        approvedAt: new Date(),
        approvedByUserId,
      })
      .where("id", "=", id)
      .executeTakeFirst()
    return (result.numUpdatedRows ?? 0n) > 0n
  }

  async function setLocked(id: string, isLocked: boolean): Promise<void> {
    await db.updateTable("post").set({ isLocked }).where("id", "=", id).execute()
  }

  async function setSticky(
    id: string,
    communityId: string,
    position: number | null,
  ): Promise<void> {
    await db.transaction().execute(async (trx) => {
      if (position !== null) {
        await trx
          .updateTable("post")
          .set({ stickyPosition: null })
          .where("communityId", "=", communityId)
          .where("stickyPosition", "=", position)
          .execute()
      }
      await trx.updateTable("post").set({ stickyPosition: position }).where("id", "=", id).execute()
    })
  }

  return {
    create,
    update,
    deleteOwn,
    deleteById,
    setFlair,
    setLinkImageKey,
    incrementShareCount,
    incrementViewCount,
    modRemove,
    hold,
    modApprove,
    setLocked,
    setSticky,
  }
}
