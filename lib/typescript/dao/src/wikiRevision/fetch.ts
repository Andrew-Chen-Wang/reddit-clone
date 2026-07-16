import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

export type WikiRevisionListRow = {
  id: string
  note: string | null
  createdAt: Date
  authorUserId: string | null
  authorUsername: string | null
}

export function fetchWikiRevision(db: Kysely<DB>) {
  async function getOne<T extends (keyof DB["wikiRevision"])[]>(
    id: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["wikiRevision"]>, T[number]> | undefined> {
    return await db
      .selectFrom("wikiRevision")
      .select(fields)
      .where("id", "=", id)
      .executeTakeFirst()
  }

  async function listForPage(wikiPageId: string, limit: number): Promise<WikiRevisionListRow[]> {
    return await db
      .selectFrom("wikiRevision")
      .leftJoin("user", "user.id", "wikiRevision.authorUserId")
      .where("wikiRevision.wikiPageId", "=", wikiPageId)
      .select([
        "wikiRevision.id as id",
        "wikiRevision.note as note",
        "wikiRevision.createdAt as createdAt",
        "wikiRevision.authorUserId as authorUserId",
        "user.username as authorUsername",
      ])
      .orderBy("wikiRevision.createdAt", "desc")
      .orderBy("wikiRevision.id", "desc")
      .limit(limit)
      .execute()
  }

  return { getOne, listForPage }
}
