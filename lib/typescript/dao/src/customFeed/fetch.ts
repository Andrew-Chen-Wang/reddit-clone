import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

export function fetchCustomFeed(db: Kysely<DB>) {
  async function getOne<T extends (keyof DB["customFeed"])[]>(
    id: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["customFeed"]>, T[number]> | undefined> {
    return await db.selectFrom("customFeed").select(fields).where("id", "=", id).executeTakeFirst()
  }

  async function getOneByOwnerSlug<T extends (keyof DB["customFeed"])[]>(
    ownerUserId: string,
    slug: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["customFeed"]>, T[number]> | undefined> {
    return await db
      .selectFrom("customFeed")
      .select(fields)
      .where("ownerUserId", "=", ownerUserId)
      .where("slug", "=", slug)
      .executeTakeFirst()
  }

  async function listForOwner<T extends (keyof DB["customFeed"])[]>(
    ownerUserId: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["customFeed"]>, T[number]>[]> {
    return await db
      .selectFrom("customFeed")
      .select(fields)
      .where("ownerUserId", "=", ownerUserId)
      .orderBy("isFavorite", "desc")
      .orderBy((eb) => eb.fn("lower", ["name"]), "asc")
      .execute()
  }

  async function countForOwner(ownerUserId: string): Promise<number> {
    const row = await db
      .selectFrom("customFeed")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("ownerUserId", "=", ownerUserId)
      .executeTakeFirst()
    return Number(row?.count ?? 0)
  }

  async function slugsForOwner(ownerUserId: string): Promise<string[]> {
    const rows = await db
      .selectFrom("customFeed")
      .select("slug")
      .where("ownerUserId", "=", ownerUserId)
      .execute()
    return rows.map((r) => r.slug)
  }

  return { getOne, getOneByOwnerSlug, listForOwner, countForOwner, slugsForOwner }
}
