import { type Kysely, sql } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("post_view_hourly")
    .addColumn("post_id", "uuid", (col) => col.references("post.id").onDelete("cascade").notNull())
    .addColumn("bucket", "timestamptz", (col) => col.notNull())
    .addColumn("view_count", "integer", (col) => col.notNull().defaultTo(sql`0`))
    .addPrimaryKeyConstraint("post_view_hourly_pkey", ["post_id", "bucket"])
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("post_view_hourly").ifExists().execute()
}
