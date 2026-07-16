import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"
import { v7 } from "uuid"

interface CreateCommentReportInput {
  commentId: string
  reporterUserId: string
  communityRuleId?: string | null
  reasonText?: string | null
}

export function crudCommentReport(db: Kysely<DB>) {
  async function create(input: CreateCommentReportInput): Promise<boolean> {
    const row = await db
      .insertInto("commentReport")
      .values({
        id: v7(),
        commentId: input.commentId,
        reporterUserId: input.reporterUserId,
        communityRuleId: input.communityRuleId ?? null,
        reasonText: input.reasonText ?? null,
      })
      .onConflict((oc) => oc.columns(["commentId", "reporterUserId"]).doNothing())
      .returning("id")
      .executeTakeFirst()
    return row !== undefined
  }

  async function resolveForComment(
    commentId: string,
    status: string,
    resolvedByUserId: string,
  ): Promise<void> {
    await db
      .updateTable("commentReport")
      .set({ status, resolvedByUserId, resolvedAt: new Date() })
      .where("commentId", "=", commentId)
      .where("status", "=", "pending")
      .execute()
  }

  return { create, resolveForComment }
}
