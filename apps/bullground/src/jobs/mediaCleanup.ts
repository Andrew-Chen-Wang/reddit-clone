import { crudPost } from "@lib/dao/post/crud"
import { crudPostMedia } from "@lib/dao/postMedia/crud"
import { fetchPostMedia } from "@lib/dao/postMedia/fetch"
import { db } from "@template-nextjs/db"
import type { JobPayloadMap } from "@utils/queues"
import { deleteFromS3, existsOnS3 } from "@utils/aws"
import type { Job } from "bullmq"

export async function processMediaCleanup(job: Job<JobPayloadMap["media-cleanup"]>): Promise<void> {
  const { postId } = job.data

  const media = await fetchPostMedia(db).getManyByPost(postId, ["s3Key", "uploadStatus"])
  if (media.length === 0) return

  const pending = media.filter((m) => m.uploadStatus === "pending")
  if (pending.length === 0) return

  const scheduledDelay = job.opts.delay ?? 0
  const scheduledFor = job.timestamp + scheduledDelay
  const processedAt = job.processedOn ?? Date.now()
  const wasPromoted = processedAt + 1000 < scheduledFor

  if (wasPromoted) {
    const checks = await Promise.all(
      pending.map(async (m) => ({ key: m.s3Key, exists: await existsOnS3(m.s3Key) })),
    )
    const surviving = checks.filter((c) => c.exists).map((c) => c.key)
    if (surviving.length > 0) {
      await crudPostMedia(db).markCompleted(
        postId,
        surviving.map((key) => ({ s3Key: key })),
      )
    }
    await crudPostMedia(db).deletePendingByPost(postId)
    return
  }

  await Promise.all(
    pending.map(async (m) => {
      try {
        await deleteFromS3(m.s3Key)
      } catch (err: unknown) {
        console.error(`[media-cleanup] failed to delete orphan ${m.s3Key}`, err)
      }
    }),
  )
  await crudPostMedia(db).deletePendingByPost(postId)

  const remaining = await fetchPostMedia(db).countCompletedByPost(postId)
  if (remaining === 0) await crudPost(db).deleteById(postId)
}
