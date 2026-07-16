import { type Kysely, sql } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    CREATE FUNCTION readit_hot(ups integer, downs integer, created_at timestamptz)
    RETURNS double precision
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    RETURN (
      (CASE WHEN ups - downs > 0 THEN 1 WHEN ups - downs < 0 THEN -1 ELSE 0 END)
        * log(10, greatest(abs(ups - downs), 1)::numeric)::double precision
      + (extract(epoch FROM created_at) - 1134028003) / 45000.0
    )
  `.execute(db)

  await sql`
    CREATE FUNCTION readit_controversial(ups integer, downs integer)
    RETURNS double precision
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    RETURN (
      CASE
        WHEN ups <= 0 OR downs <= 0 THEN 0
        ELSE power(
          (ups + downs)::double precision,
          least(ups, downs)::double precision / greatest(ups, downs)::double precision
        )
      END
    )
  `.execute(db)

  await sql`
    CREATE FUNCTION readit_wilson(ups integer, downs integer)
    RETURNS bigint
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    RETURN (
      CASE
        WHEN ups + downs = 0 THEN 0
        ELSE floor(
          (
            (
              ups::double precision / (ups + downs)
              + 1.281551565545 * 1.281551565545 / (2 * (ups + downs))
              - 1.281551565545 * sqrt(
                (
                  (ups::double precision / (ups + downs))
                    * (1 - ups::double precision / (ups + downs))
                  + 1.281551565545 * 1.281551565545 / (4 * (ups + downs))
                ) / (ups + downs)
              )
            ) / (1 + 1.281551565545 * 1.281551565545 / (ups + downs))
          ) * 1e18
        )::bigint
      END
    )
  `.execute(db)

  await db.schema
    .createTable("post")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("community_id", "uuid", (col) => col.references("community.id").onDelete("cascade"))
    .addColumn("profile_user_id", "uuid", (col) => col.references("user.id").onDelete("cascade"))
    .addColumn("author_user_id", "uuid", (col) =>
      col.references("user.id").onDelete("cascade").notNull(),
    )
    .addColumn("type", "text", (col) => col.notNull())
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("body_md", "text")
    .addColumn("link_url", "text")
    .addColumn("is_nsfw", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("is_spoiler", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("is_oc", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("is_locked", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("sticky_position", "smallint")
    .addColumn("flair_template_id", "uuid", (col) =>
      col.references("post_flair_template.id").onDelete("set null"),
    )
    .addColumn("crosspost_of_post_id", "uuid", (col) =>
      col.references("post.id").onDelete("set null"),
    )
    .addColumn("ups", "integer", (col) => col.notNull().defaultTo(sql`0`))
    .addColumn("downs", "integer", (col) => col.notNull().defaultTo(sql`0`))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("score", "integer", (col) =>
      col
        .notNull()
        .generatedAlwaysAs(sql`ups - downs`)
        .stored(),
    )
    .addColumn("hot_score", "double precision", (col) =>
      col
        .notNull()
        .generatedAlwaysAs(sql`readit_hot(ups, downs, created_at)`)
        .stored(),
    )
    .addColumn("controversial_score", "double precision", (col) =>
      col
        .notNull()
        .generatedAlwaysAs(sql`readit_controversial(ups, downs)`)
        .stored(),
    )
    .addColumn("comment_count", "integer", (col) => col.notNull().defaultTo(sql`0`))
    .addColumn("view_count", "bigint", (col) => col.notNull().defaultTo(sql`0`))
    .addColumn("share_count", "integer", (col) => col.notNull().defaultTo(sql`0`))
    .addColumn("edited_at", "timestamptz")
    .addColumn("removed_at", "timestamptz")
    .addColumn("removed_by_user_id", "uuid", (col) =>
      col.references("user.id").onDelete("set null"),
    )
    .addColumn("approved_at", "timestamptz")
    .addColumn("approved_by_user_id", "uuid", (col) =>
      col.references("user.id").onDelete("set null"),
    )
    .addCheckConstraint(
      "post_scope_check",
      sql`(community_id IS NOT NULL AND profile_user_id IS NULL) OR (community_id IS NULL AND profile_user_id IS NOT NULL)`,
    )
    .addCheckConstraint("post_type_check", sql`type IN ('text', 'link', 'media')`)
    .addCheckConstraint("post_title_length_check", sql`char_length(title) <= 300`)
    .addCheckConstraint(
      "post_sticky_position_check",
      sql`sticky_position IS NULL OR sticky_position IN (1, 2)`,
    )
    .execute()

  await sql`ALTER TABLE post SET (fillfactor = 90)`.execute(db)

  await sql`
    CREATE UNIQUE INDEX post_sticky_per_community_key ON post (community_id, sticky_position)
    WHERE sticky_position IS NOT NULL
  `.execute(db)

  const liveScopes = [
    ["community_id", "community"],
    ["profile_user_id", "profile"],
  ] as const
  const sorts = [
    ["hot_score", "hot"],
    ["score", "score"],
    ["created_at", "new"],
    ["controversial_score", "contro"],
  ] as const

  for (const [scopeCol, scopeName] of liveScopes) {
    for (const [sortCol, sortName] of sorts) {
      await sql`
        CREATE INDEX ${sql.raw(`post_${scopeName}_${sortName}_idx`)}
        ON post (${sql.raw(scopeCol)}, ${sql.raw(sortCol)} DESC, id DESC)
        WHERE removed_at IS NULL AND ${sql.raw(scopeCol)} IS NOT NULL
      `.execute(db)
    }
  }
  for (const [sortCol, sortName] of sorts) {
    await sql`
      CREATE INDEX ${sql.raw(`post_global_${sortName}_idx`)}
      ON post (${sql.raw(sortCol)} DESC, id DESC)
      WHERE removed_at IS NULL
    `.execute(db)
  }

  await db.schema
    .createIndex("post_author_idx")
    .on("post")
    .columns(["author_user_id", "created_at desc"])
    .execute()

  await db.schema
    .createTable("post_vote")
    .addColumn("post_id", "uuid", (col) => col.references("post.id").onDelete("cascade").notNull())
    .addColumn("user_id", "uuid", (col) => col.references("user.id").onDelete("cascade").notNull())
    .addColumn("value", "smallint", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("post_vote_pkey", ["post_id", "user_id"])
    .addCheckConstraint("post_vote_value_check", sql`value IN (-1, 1)`)
    .execute()

  await db.schema
    .createIndex("post_vote_user_idx")
    .on("post_vote")
    .columns(["user_id", "updated_at desc"])
    .execute()

  await db.schema
    .createTable("post_rising")
    .addColumn("post_id", "uuid", (col) =>
      col.primaryKey().references("post.id").onDelete("cascade"),
    )
    .addColumn("community_id", "uuid", (col) => col.notNull())
    .addColumn("score", "double precision", (col) => col.notNull())
    .addColumn("computed_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createIndex("post_rising_score_idx")
    .on("post_rising")
    .columns(["score desc"])
    .execute()
  await db.schema
    .createIndex("post_rising_community_idx")
    .on("post_rising")
    .columns(["community_id", "score desc"])
    .execute()

  await db.schema
    .createTable("post_view")
    .addColumn("user_id", "uuid", (col) => col.references("user.id").onDelete("cascade").notNull())
    .addColumn("post_id", "uuid", (col) => col.references("post.id").onDelete("cascade").notNull())
    .addColumn("viewed_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("post_view_pkey", ["user_id", "post_id"])
    .execute()

  await db.schema
    .createIndex("post_view_user_recency_idx")
    .on("post_view")
    .columns(["user_id", "viewed_at desc"])
    .execute()

  await db.schema
    .createTable("community_visit")
    .addColumn("user_id", "uuid", (col) => col.references("user.id").onDelete("cascade").notNull())
    .addColumn("community_id", "uuid", (col) =>
      col.references("community.id").onDelete("cascade").notNull(),
    )
    .addColumn("last_visited_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("community_visit_pkey", ["user_id", "community_id"])
    .execute()

  await db.schema
    .createIndex("community_visit_user_recency_idx")
    .on("community_visit")
    .columns(["user_id", "last_visited_at desc"])
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("community_visit").ifExists().execute()
  await db.schema.dropTable("post_view").ifExists().execute()
  await db.schema.dropTable("post_rising").ifExists().execute()
  await db.schema.dropTable("post_vote").ifExists().execute()
  await db.schema.dropTable("post").ifExists().execute()
  await sql`DROP FUNCTION IF EXISTS readit_wilson(integer, integer)`.execute(db)
  await sql`DROP FUNCTION IF EXISTS readit_controversial(integer, integer)`.execute(db)
  await sql`DROP FUNCTION IF EXISTS readit_hot(integer, integer, timestamptz)`.execute(db)
}
