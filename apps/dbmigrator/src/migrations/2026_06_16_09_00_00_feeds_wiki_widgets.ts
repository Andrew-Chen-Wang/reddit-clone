import { type Kysely, sql } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("custom_feed")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("owner_user_id", "uuid", (col) =>
      col.references("user.id").onDelete("cascade").notNull(),
    )
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("slug", "text", (col) => col.notNull())
    .addColumn("description", "text")
    .addColumn("is_favorite", "boolean", (col) => col.notNull().defaultTo(sql`false`))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint("custom_feed_owner_slug_key", ["owner_user_id", "slug"])
    .execute()

  await db.schema
    .createTable("custom_feed_community")
    .addColumn("custom_feed_id", "uuid", (col) =>
      col.references("custom_feed.id").onDelete("cascade").notNull(),
    )
    .addColumn("community_id", "uuid", (col) =>
      col.references("community.id").onDelete("cascade").notNull(),
    )
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("custom_feed_community_pkey", ["custom_feed_id", "community_id"])
    .execute()

  await db.schema
    .createTable("wiki_page")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("community_id", "uuid", (col) =>
      col.references("community.id").onDelete("cascade").notNull(),
    )
    .addColumn("slug", "text", (col) => col.notNull())
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("current_revision_id", "uuid")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint("wiki_page_community_slug_key", ["community_id", "slug"])
    .execute()

  await db.schema
    .createTable("wiki_revision")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("wiki_page_id", "uuid", (col) =>
      col.references("wiki_page.id").onDelete("cascade").notNull(),
    )
    .addColumn("body_md", "text", (col) => col.notNull())
    .addColumn("author_user_id", "uuid", (col) => col.references("user.id").onDelete("set null"))
    .addColumn("note", "text")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createIndex("wiki_revision_page_idx")
    .on("wiki_revision")
    .columns(["wiki_page_id", "created_at desc"])
    .execute()

  await sql`
    ALTER TABLE wiki_page
    ADD CONSTRAINT wiki_page_current_revision_fkey
    FOREIGN KEY (current_revision_id) REFERENCES wiki_revision(id) ON DELETE SET NULL
  `.execute(db)

  await db.schema
    .createTable("community_bookmark")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("community_id", "uuid", (col) =>
      col.references("community.id").onDelete("cascade").notNull(),
    )
    .addColumn("position", "integer", (col) => col.notNull().defaultTo(sql`0`))
    .addColumn("label", "text", (col) => col.notNull())
    .addColumn("url", "text", (col) => col.notNull())
    .execute()

  await db.schema
    .createIndex("community_bookmark_community_idx")
    .on("community_bookmark")
    .columns(["community_id", "position"])
    .execute()

  await db.schema
    .createTable("community_widget")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("community_id", "uuid", (col) =>
      col.references("community.id").onDelete("cascade").notNull(),
    )
    .addColumn("position", "integer", (col) => col.notNull().defaultTo(sql`0`))
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("body_md", "text", (col) => col.notNull())
    .execute()

  await db.schema
    .createIndex("community_widget_community_idx")
    .on("community_widget")
    .columns(["community_id", "position"])
    .execute()

  await db.schema
    .createTable("community_related")
    .addColumn("community_id", "uuid", (col) =>
      col.references("community.id").onDelete("cascade").notNull(),
    )
    .addColumn("related_community_id", "uuid", (col) =>
      col.references("community.id").onDelete("cascade").notNull(),
    )
    .addColumn("position", "integer", (col) => col.notNull().defaultTo(sql`0`))
    .addPrimaryKeyConstraint("community_related_pkey", ["community_id", "related_community_id"])
    .addCheckConstraint(
      "community_related_not_self_check",
      sql`community_id <> related_community_id`,
    )
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("community_related").ifExists().execute()
  await db.schema.dropTable("community_widget").ifExists().execute()
  await db.schema.dropTable("community_bookmark").ifExists().execute()
  await sql`ALTER TABLE wiki_page DROP CONSTRAINT IF EXISTS wiki_page_current_revision_fkey`.execute(
    db,
  )
  await db.schema.dropTable("wiki_revision").ifExists().execute()
  await db.schema.dropTable("wiki_page").ifExists().execute()
  await db.schema.dropTable("custom_feed_community").ifExists().execute()
  await db.schema.dropTable("custom_feed").ifExists().execute()
}
