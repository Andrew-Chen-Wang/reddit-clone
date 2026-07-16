import { type Kysely, sql } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("community")
    .addColumn("welcome_message", "text")
    .addColumn("post_guidelines", "text")
    .addColumn("allowed_post_types", "text", (col) => col.notNull().defaultTo(sql`'all'`))
    .addColumn("body_policy", "text", (col) => col.notNull().defaultTo(sql`'optional'`))
    .addColumn("title_regex", "text")
    .addColumn("link_domain_whitelist", sql`text[]`)
    .addColumn("link_domain_blacklist", sql`text[]`)
    .addColumn("media_in_comments", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("require_post_flair", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("hold_for_review", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("spoiler_enabled", "boolean", (col) => col.notNull().defaultTo(sql`true`))
    .addColumn("archive_old_posts", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("appear_in_feeds", "boolean", (col) => col.notNull().defaultTo(sql`true`))
    .addColumn("appear_in_recommendations", "boolean", (col) => col.notNull().defaultTo(sql`true`))
    .addColumn("notify_activity", "boolean", (col) => col.notNull().defaultTo(sql`true`))
    .addColumn("notify_reports", "boolean", (col) => col.notNull().defaultTo(sql`true`))
    .addColumn("notify_milestones", "boolean", (col) => col.notNull().defaultTo(sql`true`))
    .execute()

  await sql`ALTER TABLE community ADD CONSTRAINT community_allowed_post_types_check CHECK (allowed_post_types IN ('all', 'text_only', 'links_only'))`.execute(
    db,
  )
  await sql`ALTER TABLE community ADD CONSTRAINT community_body_policy_check CHECK (body_policy IN ('optional', 'required', 'none'))`.execute(
    db,
  )

  await db.schema
    .createTable("removal_reason")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("community_id", "uuid", (col) =>
      col.references("community.id").onDelete("cascade").notNull(),
    )
    .addColumn("position", "integer", (col) => col.notNull())
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("message", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute()
  await db.schema
    .createIndex("removal_reason_community_idx")
    .on("removal_reason")
    .column("community_id")
    .execute()

  await db.schema
    .alterTable("post")
    .addColumn("removal_reason_id", "uuid", (col) =>
      col.references("removal_reason.id").onDelete("set null"),
    )
    .addColumn("is_spam", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .execute()
  await db.schema
    .alterTable("comment")
    .addColumn("removal_reason_id", "uuid", (col) =>
      col.references("removal_reason.id").onDelete("set null"),
    )
    .addColumn("is_spam", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .execute()

  for (const entity of ["post", "comment"] as const) {
    await db.schema
      .createTable(`${entity}_report`)
      .addColumn("id", "uuid", (col) => col.primaryKey())
      .addColumn(`${entity}_id`, "uuid", (col) =>
        col.references(`${entity}.id`).onDelete("cascade").notNull(),
      )
      .addColumn("reporter_user_id", "uuid", (col) =>
        col.references("user.id").onDelete("cascade").notNull(),
      )
      .addColumn("community_rule_id", "uuid", (col) =>
        col.references("community_rule.id").onDelete("set null"),
      )
      .addColumn("reason_text", "text")
      .addColumn("status", "text", (col) => col.notNull().defaultTo(sql`'pending'`))
      .addColumn("resolved_by_user_id", "uuid", (col) =>
        col.references("user.id").onDelete("set null"),
      )
      .addColumn("resolved_at", "timestamptz")
      .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint(`${entity}_report_unique_reporter`, [`${entity}_id`, "reporter_user_id"])
      .addCheckConstraint(
        `${entity}_report_status_check`,
        sql`status IN ('pending', 'approved', 'removed', 'dismissed')`,
      )
      .execute()
    await db.schema
      .createIndex(`${entity}_report_status_idx`)
      .on(`${entity}_report`)
      .columns(["status", "created_at desc"])
      .execute()
  }

  await db.schema
    .createTable("community_moderator_invite")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("community_id", "uuid", (col) =>
      col.references("community.id").onDelete("cascade").notNull(),
    )
    .addColumn("invitee_user_id", "uuid", (col) =>
      col.references("user.id").onDelete("cascade").notNull(),
    )
    .addColumn("invited_by_user_id", "uuid", (col) =>
      col.references("user.id").onDelete("set null"),
    )
    .addColumn("perm_everything", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("perm_users", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("perm_config", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("perm_flair", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("perm_mail", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("perm_posts_comments", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("perm_wiki", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("status", "text", (col) => col.notNull().defaultTo(sql`'pending'`))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("resolved_at", "timestamptz")
    .addCheckConstraint(
      "community_moderator_invite_status_check",
      sql`status IN ('pending', 'accepted', 'declined')`,
    )
    .execute()
  await sql`
    CREATE UNIQUE INDEX community_moderator_invite_pending_key
    ON community_moderator_invite (community_id, invitee_user_id)
    WHERE status = 'pending'
  `.execute(db)
  await db.schema
    .createIndex("community_moderator_invite_invitee_idx")
    .on("community_moderator_invite")
    .columns(["invitee_user_id", "status"])
    .execute()

  await db.schema
    .createTable("community_ban")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("community_id", "uuid", (col) =>
      col.references("community.id").onDelete("cascade").notNull(),
    )
    .addColumn("user_id", "uuid", (col) => col.references("user.id").onDelete("cascade").notNull())
    .addColumn("community_rule_id", "uuid", (col) =>
      col.references("community_rule.id").onDelete("set null"),
    )
    .addColumn("mod_note", "text")
    .addColumn("message_to_user", "text")
    .addColumn("expires_at", "timestamptz")
    .addColumn("banned_by_user_id", "uuid", (col) => col.references("user.id").onDelete("set null"))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint("community_ban_community_user_key", ["community_id", "user_id"])
    .execute()
  await db.schema
    .createIndex("community_ban_user_idx")
    .on("community_ban")
    .column("user_id")
    .execute()

  await db.schema
    .createTable("community_muted_user")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("community_id", "uuid", (col) =>
      col.references("community.id").onDelete("cascade").notNull(),
    )
    .addColumn("user_id", "uuid", (col) => col.references("user.id").onDelete("cascade").notNull())
    .addColumn("expires_at", "timestamptz")
    .addColumn("muted_by_user_id", "uuid", (col) => col.references("user.id").onDelete("set null"))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint("community_muted_user_key", ["community_id", "user_id"])
    .execute()

  await db.schema
    .createTable("community_approved_user")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("community_id", "uuid", (col) =>
      col.references("community.id").onDelete("cascade").notNull(),
    )
    .addColumn("user_id", "uuid", (col) => col.references("user.id").onDelete("cascade").notNull())
    .addColumn("approved_by_user_id", "uuid", (col) =>
      col.references("user.id").onDelete("set null"),
    )
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint("community_approved_user_key", ["community_id", "user_id"])
    .execute()
  await db.schema
    .createIndex("community_approved_user_user_idx")
    .on("community_approved_user")
    .column("user_id")
    .execute()

  await db.schema
    .createTable("mod_action")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("community_id", "uuid", (col) =>
      col.references("community.id").onDelete("cascade").notNull(),
    )
    .addColumn("mod_user_id", "uuid", (col) => col.references("user.id").onDelete("set null"))
    .addColumn("action", "text", (col) => col.notNull())
    .addColumn("target_post_id", "uuid", (col) => col.references("post.id").onDelete("set null"))
    .addColumn("target_comment_id", "uuid", (col) =>
      col.references("comment.id").onDelete("set null"),
    )
    .addColumn("target_user_id", "uuid", (col) => col.references("user.id").onDelete("set null"))
    .addColumn("details", "jsonb")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute()
  await db.schema
    .createIndex("mod_action_community_idx")
    .on("mod_action")
    .columns(["community_id", "created_at desc"])
    .execute()

  await db.schema
    .createTable("mod_saved_response")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("community_id", "uuid", (col) =>
      col.references("community.id").onDelete("cascade").notNull(),
    )
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("body_md", "text", (col) => col.notNull())
    .addColumn("created_by_user_id", "uuid", (col) =>
      col.references("user.id").onDelete("set null"),
    )
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute()
  await db.schema
    .createIndex("mod_saved_response_community_idx")
    .on("mod_saved_response")
    .column("community_id")
    .execute()

  await db.schema
    .createTable("mod_note")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("community_id", "uuid", (col) =>
      col.references("community.id").onDelete("cascade").notNull(),
    )
    .addColumn("target_user_id", "uuid", (col) =>
      col.references("user.id").onDelete("cascade").notNull(),
    )
    .addColumn("label", "text")
    .addColumn("note", "text", (col) => col.notNull())
    .addColumn("created_by_user_id", "uuid", (col) =>
      col.references("user.id").onDelete("set null"),
    )
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute()
  await db.schema
    .createIndex("mod_note_community_user_idx")
    .on("mod_note")
    .columns(["community_id", "target_user_id", "created_at desc"])
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("mod_note").ifExists().execute()
  await db.schema.dropTable("mod_saved_response").ifExists().execute()
  await db.schema.dropTable("mod_action").ifExists().execute()
  await db.schema.dropTable("community_approved_user").ifExists().execute()
  await db.schema.dropTable("community_muted_user").ifExists().execute()
  await db.schema.dropTable("community_ban").ifExists().execute()
  await db.schema.dropTable("community_moderator_invite").ifExists().execute()
  await db.schema.dropTable("comment_report").ifExists().execute()
  await db.schema.dropTable("post_report").ifExists().execute()
  await db.schema
    .alterTable("comment")
    .dropColumn("removal_reason_id")
    .dropColumn("is_spam")
    .execute()
  await db.schema.alterTable("post").dropColumn("removal_reason_id").dropColumn("is_spam").execute()
  await db.schema.dropTable("removal_reason").ifExists().execute()
  await sql`ALTER TABLE community DROP CONSTRAINT IF EXISTS community_body_policy_check`.execute(db)
  await sql`ALTER TABLE community DROP CONSTRAINT IF EXISTS community_allowed_post_types_check`.execute(
    db,
  )
  await db.schema
    .alterTable("community")
    .dropColumn("welcome_message")
    .dropColumn("post_guidelines")
    .dropColumn("allowed_post_types")
    .dropColumn("body_policy")
    .dropColumn("title_regex")
    .dropColumn("link_domain_whitelist")
    .dropColumn("link_domain_blacklist")
    .dropColumn("media_in_comments")
    .dropColumn("require_post_flair")
    .dropColumn("hold_for_review")
    .dropColumn("spoiler_enabled")
    .dropColumn("archive_old_posts")
    .dropColumn("appear_in_feeds")
    .dropColumn("appear_in_recommendations")
    .dropColumn("notify_activity")
    .dropColumn("notify_reports")
    .dropColumn("notify_milestones")
    .execute()
}
