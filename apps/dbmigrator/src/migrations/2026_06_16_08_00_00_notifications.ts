import { type Kysely, sql } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("notification")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("user_id", "uuid", (col) => col.references("user.id").onDelete("cascade").notNull())
    .addColumn("type", "text", (col) => col.notNull())
    .addColumn("actor_user_id", "uuid", (col) => col.references("user.id").onDelete("set null"))
    .addColumn("post_id", "uuid", (col) => col.references("post.id").onDelete("cascade"))
    .addColumn("comment_id", "uuid", (col) => col.references("comment.id").onDelete("cascade"))
    .addColumn("community_id", "uuid", (col) => col.references("community.id").onDelete("cascade"))
    .addColumn("conversation_id", "uuid", (col) =>
      col.references("chat_conversation.id").onDelete("cascade"),
    )
    .addColumn("preview_snapshot", "jsonb")
    .addColumn("read_at", "timestamptz")
    .addColumn("archived_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute()
  await db.schema
    .createIndex("notification_user_created_idx")
    .on("notification")
    .columns(["user_id", "created_at desc"])
    .execute()
  await sql`
    CREATE INDEX notification_user_unread_idx
    ON notification (user_id)
    WHERE read_at IS NULL
  `.execute(db)

  await db.schema
    .createTable("user_notification_preference")
    .addColumn("user_id", "uuid", (col) => col.references("user.id").onDelete("cascade").notNull())
    .addColumn("type", "text", (col) => col.notNull())
    .addColumn("level", "text", (col) => col.notNull().defaultTo(sql`'inbox'`))
    .addPrimaryKeyConstraint("user_notification_preference_pkey", ["user_id", "type"])
    .addCheckConstraint(
      "user_notification_preference_level_check",
      sql`level IN ('off', 'inbox', 'all')`,
    )
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("user_notification_preference").ifExists().execute()
  await db.schema.dropTable("notification").ifExists().execute()
}
