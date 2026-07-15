import { type Kysely, sql } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("user")
    .addColumn("username", "text")
    .addColumn("display_name", "text")
    .addColumn("about", "text")
    .addColumn("avatar_image_key", "text")
    .addColumn("banner_image_key", "text")
    .addColumn("post_karma", "integer", (col) => col.notNull().defaultTo(sql`0`))
    .addColumn("comment_karma", "integer", (col) => col.notNull().defaultTo(sql`0`))
    .addColumn("suspended_at", "timestamptz")
    .addColumn("suspension_reason", "text")
    .execute()

  await sql`
    UPDATE "user"
    SET username = regexp_replace(split_part(email, '@', 1), '[^A-Za-z0-9_-]', '', 'g')
      || '-' || substr(md5(id::text), 1, 6)
    WHERE username IS NULL
  `.execute(db)

  await db.schema
    .alterTable("user")
    .alterColumn("username", (col) => col.setNotNull())
    .execute()

  await sql`CREATE UNIQUE INDEX user_username_lower_key ON "user" (lower(username))`.execute(db)

  await db.schema
    .createTable("user_settings")
    .addColumn("user_id", "uuid", (col) =>
      col.primaryKey().references("user.id").onDelete("cascade"),
    )
    .addColumn("display_mode", "text", (col) => col.notNull().defaultTo(sql`'auto'`))
    .addColumn("feed_view", "text", (col) => col.notNull().defaultTo(sql`'card'`))
    .addColumn("default_markdown_editor", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("show_mature", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("blur_mature", "boolean", (col) => col.notNull().defaultTo(sql`true`))
    .addColumn("allow_follows", "boolean", (col) => col.notNull().defaultTo(sql`true`))
    .addColumn("chat_request_policy", "text", (col) => col.notNull().defaultTo(sql`'everyone'`))
    .addColumn("show_in_search", "boolean", (col) => col.notNull().defaultTo(sql`true`))
    .addColumn("show_recommendations", "boolean", (col) => col.notNull().defaultTo(sql`true`))
    .addColumn("autoplay_media", "boolean", (col) => col.notNull().defaultTo(sql`true`))
    .addColumn("reduce_motion", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("open_posts_new_tab", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("safe_search", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("show_follower_count", "boolean", (col) => col.notNull().defaultTo(sql`true`))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("user_settings").ifExists().execute()
  await db.schema.dropIndex("user_username_lower_key").ifExists().execute()
  await db.schema
    .alterTable("user")
    .dropColumn("username")
    .dropColumn("display_name")
    .dropColumn("about")
    .dropColumn("avatar_image_key")
    .dropColumn("banner_image_key")
    .dropColumn("post_karma")
    .dropColumn("comment_karma")
    .dropColumn("suspended_at")
    .dropColumn("suspension_reason")
    .execute()
}
