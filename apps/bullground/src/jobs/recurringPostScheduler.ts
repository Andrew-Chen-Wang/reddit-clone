import { crudScheduledPost } from "@lib/dao/scheduledPost/crud"
import { fetchScheduledPost } from "@lib/dao/scheduledPost/fetch"
import { db } from "@template-nextjs/db"
import { enqueueScheduledPostPublish, type JobPayloadMap } from "@utils/queues"

const RECURRENCES = new Set(["daily", "weekly", "monthly"])

function nextOccurrence(anchor: Date, recurrence: string, after: Date): Date {
  const next = new Date(anchor)
  while (next.getTime() <= after.getTime()) {
    if (recurrence === "daily") next.setUTCDate(next.getUTCDate() + 1)
    else if (recurrence === "weekly") next.setUTCDate(next.getUTCDate() + 7)
    else next.setUTCMonth(next.getUTCMonth() + 1)
  }
  return next
}

export async function processRecurringPostScheduler(
  _data: JobPayloadMap["recurring-post-scheduler"],
): Promise<void> {
  const sources = await fetchScheduledPost(db).listPublishedRecurring()
  const now = new Date()
  let spawned = 0

  for (const src of sources) {
    if (!src.recurrence || !RECURRENCES.has(src.recurrence)) continue

    const occurrence = nextOccurrence(src.scheduledAt, src.recurrence, now)
    const occurrenceJobId = `scheduled-post__recurring__${src.id}__${occurrence.getTime()}`

    if (await fetchScheduledPost(db).existsByJobId(occurrenceJobId)) {
      await crudScheduledPost(db).clearRecurrence(src.id)
      continue
    }

    const created = await crudScheduledPost(db).create({
      authorUserId: src.authorUserId,
      communityId: src.communityId,
      isProfile: src.isProfile,
      type: src.type,
      title: src.title,
      bodyMd: src.bodyMd,
      linkUrl: src.linkUrl,
      isNsfw: src.isNsfw,
      isSpoiler: src.isSpoiler,
      isOc: src.isOc,
      flairTemplateId: src.flairTemplateId,
      scheduledAt: occurrence,
      recurrence: src.recurrence,
      jobId: occurrenceJobId,
    })

    await enqueueScheduledPostPublish(
      created.id,
      occurrence.getTime() - Date.now(),
      occurrenceJobId,
    )
    await crudScheduledPost(db).clearRecurrence(src.id)
    spawned++
  }

  console.info(`[recurring-post-scheduler] spawned ${spawned} occurrence(s)`)
}
