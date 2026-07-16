import type { DB } from "@template-nextjs/db"
import { type Kysely, type Selectable } from "kysely"
import { v7 } from "uuid"

interface CreateScheduledPostInput {
  id?: string
  authorUserId: string
  communityId?: string | null
  isProfile?: boolean
  type?: string
  title: string
  bodyMd?: string | null
  linkUrl?: string | null
  isNsfw?: boolean
  isSpoiler?: boolean
  isOc?: boolean
  flairTemplateId?: string | null
  scheduledAt: Date
  recurrence?: string | null
  jobId?: string | null
}

export function crudScheduledPost(db: Kysely<DB>) {
  async function create(input: CreateScheduledPostInput): Promise<Selectable<DB["scheduledPost"]>> {
    return await db
      .insertInto("scheduledPost")
      .values({
        id: input.id ?? v7(),
        authorUserId: input.authorUserId,
        communityId: input.communityId ?? null,
        isProfile: input.isProfile ?? false,
        type: input.type ?? "text",
        title: input.title,
        bodyMd: input.bodyMd ?? null,
        linkUrl: input.linkUrl ?? null,
        isNsfw: input.isNsfw ?? false,
        isSpoiler: input.isSpoiler ?? false,
        isOc: input.isOc ?? false,
        flairTemplateId: input.flairTemplateId ?? null,
        scheduledAt: input.scheduledAt,
        recurrence: input.recurrence ?? null,
        status: "scheduled",
        jobId: input.jobId ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  async function setJobId(id: string, jobId: string): Promise<void> {
    await db.updateTable("scheduledPost").set({ jobId }).where("id", "=", id).execute()
  }

  async function cancel(id: string, authorUserId: string): Promise<boolean> {
    const result = await db
      .updateTable("scheduledPost")
      .set({ status: "canceled" })
      .where("id", "=", id)
      .where("authorUserId", "=", authorUserId)
      .where("status", "=", "scheduled")
      .executeTakeFirst()
    return (result.numUpdatedRows ?? 0n) > 0n
  }

  async function markCanceled(id: string): Promise<void> {
    await db.updateTable("scheduledPost").set({ status: "canceled" }).where("id", "=", id).execute()
  }

  async function markPublished(id: string, publishedPostId: string): Promise<void> {
    await db
      .updateTable("scheduledPost")
      .set({ status: "published", publishedPostId })
      .where("id", "=", id)
      .execute()
  }

  async function clearRecurrence(id: string): Promise<void> {
    await db.updateTable("scheduledPost").set({ recurrence: null }).where("id", "=", id).execute()
  }

  return { create, setJobId, cancel, markCanceled, markPublished, clearRecurrence }
}
