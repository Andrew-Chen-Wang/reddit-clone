import type { Kysely } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("post").addColumn("link_image_key", "text").execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("post").dropColumn("link_image_key").execute()
}
