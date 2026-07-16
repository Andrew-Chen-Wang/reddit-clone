import type { DB } from "@template-nextjs/db"
import { type Kysely, type Selectable } from "kysely"
import { v7 } from "uuid"

interface CreateDraftInput {
  id?: string
  userId: string
  communityId?: string | null
  isProfile?: boolean
  type?: string
  title?: string | null
  bodyMd?: string | null
  linkUrl?: string | null
  isNsfw?: boolean
  isSpoiler?: boolean
  isOc?: boolean
  flairTemplateId?: string | null
}

interface UpdateDraftInput {
  communityId?: string | null
  isProfile?: boolean
  type?: string
  title?: string | null
  bodyMd?: string | null
  linkUrl?: string | null
  isNsfw?: boolean
  isSpoiler?: boolean
  isOc?: boolean
  flairTemplateId?: string | null
}

export function crudPostDraft(db: Kysely<DB>) {
  async function create(input: CreateDraftInput): Promise<Selectable<DB["postDraft"]>> {
    return await db
      .insertInto("postDraft")
      .values({
        id: input.id ?? v7(),
        userId: input.userId,
        communityId: input.communityId ?? null,
        isProfile: input.isProfile ?? false,
        type: input.type ?? "text",
        title: input.title ?? null,
        bodyMd: input.bodyMd ?? null,
        linkUrl: input.linkUrl ?? null,
        isNsfw: input.isNsfw ?? false,
        isSpoiler: input.isSpoiler ?? false,
        isOc: input.isOc ?? false,
        flairTemplateId: input.flairTemplateId ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  async function update(
    id: string,
    userId: string,
    patch: UpdateDraftInput,
  ): Promise<Selectable<DB["postDraft"]> | undefined> {
    return await db
      .updateTable("postDraft")
      .set({ ...patch, updatedAt: new Date() })
      .where("id", "=", id)
      .where("userId", "=", userId)
      .returningAll()
      .executeTakeFirst()
  }

  async function deleteOwn(id: string, userId: string): Promise<boolean> {
    const result = await db
      .deleteFrom("postDraft")
      .where("id", "=", id)
      .where("userId", "=", userId)
      .executeTakeFirst()
    return (result.numDeletedRows ?? 0n) > 0n
  }

  async function deleteExpired(before: Date): Promise<number> {
    const result = await db
      .deleteFrom("postDraft")
      .where("updatedAt", "<", before)
      .executeTakeFirst()
    return Number(result.numDeletedRows ?? 0n)
  }

  return { create, update, deleteOwn, deleteExpired }
}
