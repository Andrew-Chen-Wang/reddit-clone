import { type Kysely, sql } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("topic")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("slug", "text", (col) => col.notNull())
    .addColumn("display_order", "integer", (col) => col.notNull())
    .addUniqueConstraint("topic_slug_key", ["slug"])
    .execute()

  await db.schema
    .createTable("community")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("display_name", "text")
    .addColumn("description", "text", (col) => col.notNull())
    .addColumn("visibility", "text", (col) => col.notNull().defaultTo(sql`'public'`))
    .addColumn("is_nsfw", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("topic_id", "uuid", (col) => col.references("topic.id").onDelete("set null"))
    .addColumn("icon_image_key", "text")
    .addColumn("banner_image_key", "text")
    .addColumn("member_count", "integer", (col) => col.notNull().defaultTo(sql`0`))
    .addColumn("default_comment_sort", "text", (col) => col.notNull().defaultTo(sql`'best'`))
    .addColumn("created_by_user_id", "uuid", (col) =>
      col.references("user.id").onDelete("set null"),
    )
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addCheckConstraint("community_name_format_check", sql`name ~ '^[A-Za-z0-9_]{3,21}$'`)
    .addCheckConstraint(
      "community_visibility_check",
      sql`visibility IN ('public', 'restricted', 'private')`,
    )
    .addCheckConstraint(
      "community_default_comment_sort_check",
      sql`default_comment_sort IN ('best', 'top', 'new', 'controversial', 'old')`,
    )
    .execute()

  await sql`CREATE UNIQUE INDEX community_name_lower_key ON community (lower(name))`.execute(db)
  await db.schema
    .createIndex("community_topic_id_index")
    .on("community")
    .column("topic_id")
    .execute()

  await db.schema
    .createTable("community_member")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("community_id", "uuid", (col) =>
      col.references("community.id").onDelete("cascade").notNull(),
    )
    .addColumn("user_id", "uuid", (col) => col.references("user.id").onDelete("cascade").notNull())
    .addColumn("is_favorite", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("notification_level", "text", (col) => col.notNull().defaultTo(sql`'low'`))
    .addColumn("joined_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint("community_member_community_user_key", ["community_id", "user_id"])
    .addCheckConstraint(
      "community_member_notification_level_check",
      sql`notification_level IN ('off', 'low', 'frequent')`,
    )
    .execute()

  await db.schema
    .createIndex("community_member_user_id_index")
    .on("community_member")
    .column("user_id")
    .execute()

  await db.schema
    .createTable("community_moderator")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("community_id", "uuid", (col) =>
      col.references("community.id").onDelete("cascade").notNull(),
    )
    .addColumn("user_id", "uuid", (col) => col.references("user.id").onDelete("cascade").notNull())
    .addColumn("position", "integer", (col) => col.notNull())
    .addColumn("perm_everything", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("perm_users", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("perm_config", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("perm_flair", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("perm_mail", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("perm_posts_comments", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("perm_wiki", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("added_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint("community_moderator_community_user_key", ["community_id", "user_id"])
    .execute()

  await db.schema
    .createIndex("community_moderator_user_id_index")
    .on("community_moderator")
    .column("user_id")
    .execute()

  await db.schema
    .createTable("community_rule")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("community_id", "uuid", (col) =>
      col.references("community.id").onDelete("cascade").notNull(),
    )
    .addColumn("position", "integer", (col) => col.notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("description", "text")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createIndex("community_rule_community_id_index")
    .on("community_rule")
    .column("community_id")
    .execute()

  await db.schema
    .createTable("community_join_request")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("community_id", "uuid", (col) =>
      col.references("community.id").onDelete("cascade").notNull(),
    )
    .addColumn("user_id", "uuid", (col) => col.references("user.id").onDelete("cascade").notNull())
    .addColumn("message", "text")
    .addColumn("status", "text", (col) => col.notNull().defaultTo(sql`'pending'`))
    .addColumn("resolved_by_user_id", "uuid", (col) =>
      col.references("user.id").onDelete("set null"),
    )
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("resolved_at", "timestamptz")
    .addCheckConstraint(
      "community_join_request_status_check",
      sql`status IN ('pending', 'approved', 'denied')`,
    )
    .execute()

  await sql`
    CREATE UNIQUE INDEX community_join_request_pending_key
    ON community_join_request (community_id, user_id)
    WHERE status = 'pending'
  `.execute(db)

  await db.schema
    .createIndex("community_join_request_user_id_index")
    .on("community_join_request")
    .column("user_id")
    .execute()

  await db.schema
    .createTable("post_flair_template")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("community_id", "uuid", (col) =>
      col.references("community.id").onDelete("cascade").notNull(),
    )
    .addColumn("text", "text", (col) => col.notNull())
    .addColumn("bg_color", "text")
    .addColumn("text_color", "text")
    .addColumn("mod_only", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("position", "integer", (col) => col.notNull().defaultTo(sql`0`))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createIndex("post_flair_template_community_id_index")
    .on("post_flair_template")
    .column("community_id")
    .execute()

  await db.schema
    .createTable("user_flair_template")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("community_id", "uuid", (col) =>
      col.references("community.id").onDelete("cascade").notNull(),
    )
    .addColumn("text", "text", (col) => col.notNull())
    .addColumn("bg_color", "text")
    .addColumn("text_color", "text")
    .addColumn("mod_only", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("self_assignable", "boolean", (col) => col.notNull().defaultTo(sql`true`))
    .addColumn("position", "integer", (col) => col.notNull().defaultTo(sql`0`))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createIndex("user_flair_template_community_id_index")
    .on("user_flair_template")
    .column("community_id")
    .execute()

  await db.schema
    .createTable("community_user_flair")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("community_id", "uuid", (col) =>
      col.references("community.id").onDelete("cascade").notNull(),
    )
    .addColumn("user_id", "uuid", (col) => col.references("user.id").onDelete("cascade").notNull())
    .addColumn("user_flair_template_id", "uuid", (col) =>
      col.references("user_flair_template.id").onDelete("cascade"),
    )
    .addColumn("custom_text", "text")
    .addUniqueConstraint("community_user_flair_community_user_key", ["community_id", "user_id"])
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("community_user_flair").ifExists().execute()
  await db.schema.dropTable("user_flair_template").ifExists().execute()
  await db.schema.dropTable("post_flair_template").ifExists().execute()
  await db.schema.dropTable("community_join_request").ifExists().execute()
  await db.schema.dropTable("community_rule").ifExists().execute()
  await db.schema.dropTable("community_moderator").ifExists().execute()
  await db.schema.dropTable("community_member").ifExists().execute()
  await db.schema.dropTable("community").ifExists().execute()
  await db.schema.dropTable("topic").ifExists().execute()
}
