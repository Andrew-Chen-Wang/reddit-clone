import { type Kysely, sql } from "kysely"

const PAIR_TABLES: {
  name: string
  left: { col: string; ref: string }
  right: { col: string; ref: string }
}[] = [
  {
    name: "post_save",
    left: { col: "user_id", ref: "user.id" },
    right: { col: "post_id", ref: "post.id" },
  },
  {
    name: "comment_save",
    left: { col: "user_id", ref: "user.id" },
    right: { col: "comment_id", ref: "comment.id" },
  },
  {
    name: "post_hide",
    left: { col: "user_id", ref: "user.id" },
    right: { col: "post_id", ref: "post.id" },
  },
  {
    name: "post_follow",
    left: { col: "user_id", ref: "user.id" },
    right: { col: "post_id", ref: "post.id" },
  },
  {
    name: "comment_follow",
    left: { col: "user_id", ref: "user.id" },
    right: { col: "comment_id", ref: "comment.id" },
  },
  {
    name: "user_follow",
    left: { col: "follower_user_id", ref: "user.id" },
    right: { col: "followed_user_id", ref: "user.id" },
  },
  {
    name: "user_block",
    left: { col: "blocker_user_id", ref: "user.id" },
    right: { col: "blocked_user_id", ref: "user.id" },
  },
  {
    name: "user_muted_community",
    left: { col: "user_id", ref: "user.id" },
    right: { col: "community_id", ref: "community.id" },
  },
]

export async function up(db: Kysely<any>): Promise<void> {
  for (const t of PAIR_TABLES) {
    await db.schema
      .createTable(t.name)
      .addColumn(t.left.col, "uuid", (col) =>
        col.references(t.left.ref).onDelete("cascade").notNull(),
      )
      .addColumn(t.right.col, "uuid", (col) =>
        col.references(t.right.ref).onDelete("cascade").notNull(),
      )
      .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
      .addPrimaryKeyConstraint(`${t.name}_pkey`, [t.left.col, t.right.col])
      .execute()

    await db.schema
      .createIndex(`${t.name}_left_recency_idx`)
      .on(t.name)
      .columns([t.left.col, "created_at desc"])
      .execute()
  }

  await db.schema
    .createIndex("user_follow_followed_idx")
    .on("user_follow")
    .column("followed_user_id")
    .execute()
  await db.schema.createIndex("post_follow_post_idx").on("post_follow").column("post_id").execute()
  await db.schema
    .createIndex("comment_follow_comment_idx")
    .on("comment_follow")
    .column("comment_id")
    .execute()

  await db.schema
    .createTable("post_draft")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("user_id", "uuid", (col) => col.references("user.id").onDelete("cascade").notNull())
    .addColumn("community_id", "uuid", (col) => col.references("community.id").onDelete("set null"))
    .addColumn("is_profile", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("type", "text", (col) => col.notNull().defaultTo(sql`'text'`))
    .addColumn("title", "text")
    .addColumn("body_md", "text")
    .addColumn("link_url", "text")
    .addColumn("is_nsfw", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("is_spoiler", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("is_oc", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("flair_template_id", "uuid", (col) =>
      col.references("post_flair_template.id").onDelete("set null"),
    )
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addCheckConstraint("post_draft_type_check", sql`type IN ('text', 'link', 'media')`)
    .execute()

  await db.schema
    .createIndex("post_draft_user_recency_idx")
    .on("post_draft")
    .columns(["user_id", "updated_at desc"])
    .execute()

  await db.schema
    .createTable("scheduled_post")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("author_user_id", "uuid", (col) =>
      col.references("user.id").onDelete("cascade").notNull(),
    )
    .addColumn("community_id", "uuid", (col) => col.references("community.id").onDelete("cascade"))
    .addColumn("is_profile", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("type", "text", (col) => col.notNull().defaultTo(sql`'text'`))
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("body_md", "text")
    .addColumn("link_url", "text")
    .addColumn("is_nsfw", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("is_spoiler", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("is_oc", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("flair_template_id", "uuid", (col) =>
      col.references("post_flair_template.id").onDelete("set null"),
    )
    .addColumn("scheduled_at", "timestamptz", (col) => col.notNull())
    .addColumn("recurrence", "text")
    .addColumn("status", "text", (col) => col.notNull().defaultTo(sql`'scheduled'`))
    .addColumn("published_post_id", "uuid", (col) => col.references("post.id").onDelete("set null"))
    .addColumn("job_id", "text")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addCheckConstraint("scheduled_post_type_check", sql`type IN ('text', 'link', 'media')`)
    .addCheckConstraint(
      "scheduled_post_status_check",
      sql`status IN ('scheduled', 'published', 'canceled')`,
    )
    .execute()

  await db.schema
    .createIndex("scheduled_post_status_time_idx")
    .on("scheduled_post")
    .columns(["status", "scheduled_at"])
    .execute()
  await db.schema
    .createIndex("scheduled_post_community_idx")
    .on("scheduled_post")
    .columns(["community_id", "scheduled_at"])
    .execute()
  await db.schema
    .createIndex("scheduled_post_author_idx")
    .on("scheduled_post")
    .columns(["author_user_id", "scheduled_at"])
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("scheduled_post").ifExists().execute()
  await db.schema.dropTable("post_draft").ifExists().execute()
  for (const t of PAIR_TABLES.toReversed()) {
    await db.schema.dropTable(t.name).ifExists().execute()
  }
}
