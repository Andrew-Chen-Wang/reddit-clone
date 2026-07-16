import { crudPostRising } from "@lib/dao/postRising/crud"
import { db } from "@template-nextjs/db"
import type { JobPayloadMap } from "@utils/queues"

export async function processRisingRecompute(
  _data: JobPayloadMap["rising-recompute"],
): Promise<void> {
  const count = await crudPostRising(db).recomputeRising()
  console.info(`[rising-recompute] wrote ${count} rising rows`)
}
