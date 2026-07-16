import { type Kysely, sql } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("post_media")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("post_id", "uuid", (col) => col.references("post.id").onDelete("cascade").notNull())
    .addColumn("position", "integer", (col) => col.notNull().defaultTo(sql`0`))
    .addColumn("media_type", "text", (col) => col.notNull())
    .addColumn("s3_key", "text", (col) => col.notNull())
    .addColumn("mime_type", "text")
    .addColumn("width", "integer")
    .addColumn("height", "integer")
    .addColumn("byte_size", "bigint")
    .addColumn("upload_status", "text", (col) => col.notNull().defaultTo(sql`'pending'`))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addCheckConstraint("post_media_type_check", sql`media_type IN ('image', 'video')`)
    .addCheckConstraint(
      "post_media_upload_status_check",
      sql`upload_status IN ('pending', 'completed')`,
    )
    .execute()

  await db.schema
    .createIndex("post_media_post_idx")
    .on("post_media")
    .columns(["post_id", "position"])
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("post_media").ifExists().execute()
}
