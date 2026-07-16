import { crudPostDraft } from "@lib/dao/postDraft/crud"
import { db } from "@template-nextjs/db"
import type { JobPayloadMap } from "@utils/queues"

const DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000

export async function processDraftExpiry(_data: JobPayloadMap["draft-expiry"]): Promise<void> {
  const cutoff = new Date(Date.now() - DRAFT_TTL_MS)
  const deleted = await crudPostDraft(db).deleteExpired(cutoff)
  console.info(`[draft-expiry] deleted ${deleted} expired draft(s)`)
}
