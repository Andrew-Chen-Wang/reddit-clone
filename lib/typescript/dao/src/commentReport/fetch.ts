import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"
import type { ReportSummary } from "../postReport/fetch"

export function fetchCommentReport(db: Kysely<DB>) {
  async function getPendingSummaryForComments(
    commentIds: string[],
  ): Promise<Map<string, ReportSummary>> {
    const map = new Map<string, ReportSummary>()
    if (commentIds.length === 0) return map
    const rows = await db
      .selectFrom("commentReport")
      .select(["commentId", "communityRuleId", "reasonText"])
      .where("commentId", "in", commentIds)
      .where("status", "=", "pending")
      .execute()
    for (const row of rows) {
      const entry = map.get(row.commentId) ?? { count: 0, reasons: [] }
      entry.count += 1
      entry.reasons.push({ communityRuleId: row.communityRuleId, reasonText: row.reasonText })
      map.set(row.commentId, entry)
    }
    return map
  }

  return { getPendingSummaryForComments }
}
