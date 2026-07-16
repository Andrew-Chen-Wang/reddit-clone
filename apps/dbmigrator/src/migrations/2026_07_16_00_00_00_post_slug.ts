import { type Kysely, sql } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("post").addColumn("slug", "text").execute()

  await sql`
    UPDATE post
    SET slug = regexp_replace(
      left(
        trim(both '-' from regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g')),
        50
      ),
      '-+$',
      ''
    )
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("post").dropColumn("slug").execute()
}
