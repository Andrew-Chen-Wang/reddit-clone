import { type Kysely, sql } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("user_social_link")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("user_id", "uuid", (col) => col.references("user.id").onDelete("cascade").notNull())
    .addColumn("platform", "text", (col) => col.notNull())
    .addColumn("url", "text", (col) => col.notNull())
    .addColumn("label", "text")
    .addColumn("position", "integer", (col) => col.notNull().defaultTo(sql`0`))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createIndex("user_social_link_user_position_idx")
    .on("user_social_link")
    .columns(["user_id", "position"])
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("user_social_link").ifExists().execute()
}
