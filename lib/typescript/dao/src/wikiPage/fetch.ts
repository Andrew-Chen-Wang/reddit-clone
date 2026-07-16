import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

export type WikiPageWithRevision = {
  id: string
  communityId: string
  slug: string
  title: string
  currentRevisionId: string | null
  bodyMd: string | null
  revisionCreatedAt: Date | null
  revisionAuthorUserId: string | null
  revisionAuthorUsername: string | null
}

export function fetchWikiPage(db: Kysely<DB>) {
  async function getOne<T extends (keyof DB["wikiPage"])[]>(
    id: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["wikiPage"]>, T[number]> | undefined> {
    return await db.selectFrom("wikiPage").select(fields).where("id", "=", id).executeTakeFirst()
  }

  async function getOneByCommunitySlug<T extends (keyof DB["wikiPage"])[]>(
    communityId: string,
    slug: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["wikiPage"]>, T[number]> | undefined> {
    return await db
      .selectFrom("wikiPage")
      .select(fields)
      .where("communityId", "=", communityId)
      .where("slug", "=", slug)
      .executeTakeFirst()
  }

  async function getWithCurrentRevision(
    communityId: string,
    slug: string,
  ): Promise<WikiPageWithRevision | undefined> {
    return await db
      .selectFrom("wikiPage")
      .leftJoin("wikiRevision", "wikiRevision.id", "wikiPage.currentRevisionId")
      .leftJoin("user", "user.id", "wikiRevision.authorUserId")
      .where("wikiPage.communityId", "=", communityId)
      .where("wikiPage.slug", "=", slug)
      .select([
        "wikiPage.id as id",
        "wikiPage.communityId as communityId",
        "wikiPage.slug as slug",
        "wikiPage.title as title",
        "wikiPage.currentRevisionId as currentRevisionId",
        "wikiRevision.bodyMd as bodyMd",
        "wikiRevision.createdAt as revisionCreatedAt",
        "wikiRevision.authorUserId as revisionAuthorUserId",
        "user.username as revisionAuthorUsername",
      ])
      .executeTakeFirst()
  }

  async function listForCommunity(
    communityId: string,
  ): Promise<{ id: string; slug: string; title: string }[]> {
    return await db
      .selectFrom("wikiPage")
      .select(["id", "slug", "title"])
      .where("communityId", "=", communityId)
      .orderBy("slug", "asc")
      .execute()
  }

  return { getOne, getOneByCommunitySlug, getWithCurrentRevision, listForCommunity }
}
