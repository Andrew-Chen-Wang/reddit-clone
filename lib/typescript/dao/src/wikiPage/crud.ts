import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"
import { v7 } from "uuid"
import { crudWikiRevision } from "../wikiRevision/crud"

interface CreatePageInput {
  communityId: string
  slug: string
  title: string
  bodyMd: string
  authorUserId: string | null
  note?: string | null
}

export function crudWikiPage(db: Kysely<DB>) {
  async function createWithRevision(input: CreatePageInput): Promise<Selectable<DB["wikiPage"]>> {
    return await db.transaction().execute(async (trx) => {
      const pageId = v7()
      const page = await trx
        .insertInto("wikiPage")
        .values({
          id: pageId,
          communityId: input.communityId,
          slug: input.slug,
          title: input.title,
          currentRevisionId: null,
        })
        .returningAll()
        .executeTakeFirstOrThrow()
      const revision = await crudWikiRevision(trx).create({
        wikiPageId: pageId,
        bodyMd: input.bodyMd,
        authorUserId: input.authorUserId,
        note: input.note ?? null,
      })
      return await trx
        .updateTable("wikiPage")
        .set({ currentRevisionId: revision.id })
        .where("id", "=", page.id)
        .returningAll()
        .executeTakeFirstOrThrow()
    })
  }

  async function addRevision(
    wikiPageId: string,
    input: { bodyMd: string; authorUserId: string | null; note?: string | null },
  ): Promise<Selectable<DB["wikiRevision"]>> {
    return await db.transaction().execute(async (trx) => {
      const revision = await crudWikiRevision(trx).create({
        wikiPageId,
        bodyMd: input.bodyMd,
        authorUserId: input.authorUserId,
        note: input.note ?? null,
      })
      await trx
        .updateTable("wikiPage")
        .set({ currentRevisionId: revision.id })
        .where("id", "=", wikiPageId)
        .execute()
      return revision
    })
  }

  async function revert(
    wikiPageId: string,
    sourceBodyMd: string,
    authorUserId: string | null,
    note: string | null,
  ): Promise<Selectable<DB["wikiRevision"]>> {
    return await addRevision(wikiPageId, { bodyMd: sourceBodyMd, authorUserId, note })
  }

  async function deleteOne(id: string): Promise<boolean> {
    const result = await db.deleteFrom("wikiPage").where("id", "=", id).executeTakeFirst()
    return (result.numDeletedRows ?? 0n) > 0n
  }

  return { createWithRevision, addRevision, revert, deleteOne }
}
