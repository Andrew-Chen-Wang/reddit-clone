import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export interface ReportSummary {
  count: number
  reasons: { communityRuleId: string | null; reasonText: string | null }[]
}

export function fetchPostReport(db: Kysely<DB>) {
  async function getPendingSummaryForPosts(postIds: string[]): Promise<Map<string, ReportSummary>> {
    const map = new Map<string, ReportSummary>()
    if (postIds.length === 0) return map
    const rows = await db
      .selectFrom("postReport")
      .select(["postId", "communityRuleId", "reasonText"])
      .where("postId", "in", postIds)
      .where("status", "=", "pending")
      .execute()
    for (const row of rows) {
      const entry = map.get(row.postId) ?? { count: 0, reasons: [] }
      entry.count += 1
      entry.reasons.push({ communityRuleId: row.communityRuleId, reasonText: row.reasonText })
      map.set(row.postId, entry)
    }
    return map
  }

  return { getPendingSummaryForPosts }
}
