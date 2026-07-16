import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"
import { v7 } from "uuid"

interface CreatePostReportInput {
  postId: string
  reporterUserId: string
  communityRuleId?: string | null
  reasonText?: string | null
}

export function crudPostReport(db: Kysely<DB>) {
  async function create(input: CreatePostReportInput): Promise<boolean> {
    const row = await db
      .insertInto("postReport")
      .values({
        id: v7(),
        postId: input.postId,
        reporterUserId: input.reporterUserId,
        communityRuleId: input.communityRuleId ?? null,
        reasonText: input.reasonText ?? null,
      })
      .onConflict((oc) => oc.columns(["postId", "reporterUserId"]).doNothing())
      .returning("id")
      .executeTakeFirst()
    return row !== undefined
  }

  async function resolveForPost(
    postId: string,
    status: string,
    resolvedByUserId: string,
  ): Promise<void> {
    await db
      .updateTable("postReport")
      .set({ status, resolvedByUserId, resolvedAt: new Date() })
      .where("postId", "=", postId)
      .where("status", "=", "pending")
      .execute()
  }

  return { create, resolveForPost }
}
