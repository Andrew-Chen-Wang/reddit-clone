import { type Kysely, sql } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("comment")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("post_id", "uuid", (col) => col.references("post.id").onDelete("cascade").notNull())
    .addColumn("parent_comment_id", "uuid", (col) =>
      col.references("comment.id").onDelete("cascade"),
    )
    .addColumn("path", sql`uuid[]`, (col) => col.notNull())
    .addColumn("depth", "integer", (col) => col.notNull().defaultTo(sql`0`))
    .addColumn("author_user_id", "uuid", (col) => col.references("user.id").onDelete("cascade"))
    .addColumn("body_md", "text")
    .addColumn("ups", "integer", (col) => col.notNull().defaultTo(sql`0`))
    .addColumn("downs", "integer", (col) => col.notNull().defaultTo(sql`0`))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("score", "integer", (col) =>
      col
        .notNull()
        .generatedAlwaysAs(sql`ups - downs`)
        .stored(),
    )
    .addColumn("wilson_score", "bigint", (col) =>
      col
        .notNull()
        .generatedAlwaysAs(sql`readit_wilson(ups, downs)`)
        .stored(),
    )
    .addColumn("controversial_score", "double precision", (col) =>
      col
        .notNull()
        .generatedAlwaysAs(sql`readit_controversial(ups, downs)`)
        .stored(),
    )
    .addColumn("child_count", "integer", (col) => col.notNull().defaultTo(sql`0`))
    .addColumn("is_sticky", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("is_deleted", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("edited_at", "timestamptz")
    .addColumn("removed_at", "timestamptz")
    .addColumn("removed_by_user_id", "uuid", (col) =>
      col.references("user.id").onDelete("set null"),
    )
    .addColumn("approved_at", "timestamptz")
    .addColumn("approved_by_user_id", "uuid", (col) =>
      col.references("user.id").onDelete("set null"),
    )
    .addCheckConstraint("comment_depth_check", sql`depth >= 0 AND depth <= 1000`)
    .addCheckConstraint(
      "comment_deleted_scrub_check",
      sql`is_deleted = false OR (author_user_id IS NULL AND body_md IS NULL)`,
    )
    .execute()

  await sql`ALTER TABLE comment SET (fillfactor = 90)`.execute(db)

  await sql`
    CREATE UNIQUE INDEX comment_sticky_per_post_key ON comment (post_id)
    WHERE is_sticky = true
  `.execute(db)

  await sql`CREATE INDEX comment_post_wilson_idx ON comment (post_id, wilson_score DESC, id DESC)`.execute(
    db,
  )
  await sql`CREATE INDEX comment_post_score_idx ON comment (post_id, score DESC, id DESC)`.execute(
    db,
  )
  await sql`CREATE INDEX comment_post_new_idx ON comment (post_id, created_at DESC, id DESC)`.execute(
    db,
  )
  await sql`CREATE INDEX comment_post_contro_idx ON comment (post_id, controversial_score DESC, id DESC)`.execute(
    db,
  )
  await sql`CREATE INDEX comment_post_path_idx ON comment USING GIN (path)`.execute(db)
  await sql`CREATE INDEX comment_parent_idx ON comment (parent_comment_id)`.execute(db)
  await sql`CREATE INDEX comment_author_idx ON comment (author_user_id, created_at DESC)`.execute(
    db,
  )

  await db.schema
    .createTable("comment_vote")
    .addColumn("comment_id", "uuid", (col) =>
      col.references("comment.id").onDelete("cascade").notNull(),
    )
    .addColumn("user_id", "uuid", (col) => col.references("user.id").onDelete("cascade").notNull())
    .addColumn("value", "smallint", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("comment_vote_pkey", ["comment_id", "user_id"])
    .addCheckConstraint("comment_vote_value_check", sql`value IN (-1, 1)`)
    .execute()

  await db.schema
    .createIndex("comment_vote_user_idx")
    .on("comment_vote")
    .columns(["user_id", "updated_at desc"])
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("comment_vote").ifExists().execute()
  await db.schema.dropTable("comment").ifExists().execute()
}
