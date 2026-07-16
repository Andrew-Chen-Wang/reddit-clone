import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"
import { v7 } from "uuid"

interface CreateRevisionInput {
  wikiPageId: string
  bodyMd: string
  authorUserId: string | null
  note?: string | null
}

export function crudWikiRevision(db: Kysely<DB>) {
  async function create(input: CreateRevisionInput): Promise<Selectable<DB["wikiRevision"]>> {
    return await db
      .insertInto("wikiRevision")
      .values({
        id: v7(),
        wikiPageId: input.wikiPageId,
        bodyMd: input.bodyMd,
        authorUserId: input.authorUserId,
        note: input.note ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  return { create }
}
