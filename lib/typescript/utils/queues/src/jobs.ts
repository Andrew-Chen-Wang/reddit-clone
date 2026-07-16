import type { JobsOptions, Queue } from "bullmq"
import { fastQueue, mediumQueue, slowQueue } from "./queues"

// Maps each job name to its payload shape. New jobs are added here and wired into the
// worker switch in apps/bullground. `rising-recompute` is the seed job; M3 fills it in.
export interface JobPayloadMap {
  "rising-recompute": Record<string, never>
  "media-cleanup": { postId: string }
  "scheduled-post-publish": { scheduledPostId: string }
  "recurring-post-scheduler": Record<string, never>
  "draft-expiry": Record<string, never>
  "es-sync-post": { postId: string }
  "es-sync-comment": { commentId: string }
  "es-sync-community": { communityId: string }
  "es-sync-user": { userId: string }
  "es-backfill": Record<string, never>
  "link-preview-fetch": { postId: string; linkUrl: string }
}

export type JobName = keyof JobPayloadMap

const jobQueues: { [K in JobName]: Queue } = {
  "rising-recompute": mediumQueue,
  "media-cleanup": slowQueue,
  "scheduled-post-publish": mediumQueue,
  "recurring-post-scheduler": mediumQueue,
  "draft-expiry": slowQueue,
  "es-sync-post": fastQueue,
  "es-sync-comment": fastQueue,
  "es-sync-community": fastQueue,
  "es-sync-user": fastQueue,
  "es-backfill": slowQueue,
  "link-preview-fetch": slowQueue,
}

export async function enqueue<K extends JobName>(
  name: K,
  payload: JobPayloadMap[K],
  opts?: JobsOptions,
): Promise<void> {
  await jobQueues[name].add(name, payload, opts)
}

export async function enqueueRisingRecompute(): Promise<void> {
  await enqueue(
    "rising-recompute",
    {},
    { jobId: "rising-recompute", removeOnComplete: true, removeOnFail: 100 },
  )
}

const MEDIA_CLEANUP_DELAY_MS = 30 * 60 * 1000

export function mediaCleanupJobId(postId: string): string {
  return `media-cleanup__${postId}`
}

export async function enqueueMediaCleanup(postId: string): Promise<void> {
  await enqueue(
    "media-cleanup",
    { postId },
    {
      jobId: mediaCleanupJobId(postId),
      delay: MEDIA_CLEANUP_DELAY_MS,
      removeOnComplete: true,
      removeOnFail: 100,
    },
  )
}

export async function promoteMediaCleanup(postId: string): Promise<boolean> {
  const job = await slowQueue.getJob(mediaCleanupJobId(postId))
  if (!job) return false
  try {
    await job.promote()
    return true
  } catch {
    return false
  }
}

export function scheduledPostJobId(scheduledPostId: string): string {
  return `scheduled-post__${scheduledPostId}`
}

export async function enqueueScheduledPostPublish(
  scheduledPostId: string,
  delayMs: number,
  jobId: string,
): Promise<void> {
  await enqueue(
    "scheduled-post-publish",
    { scheduledPostId },
    {
      jobId,
      delay: Math.max(0, delayMs),
      removeOnComplete: true,
      removeOnFail: 100,
    },
  )
}

export async function removeScheduledPostJob(jobId: string): Promise<boolean> {
  try {
    await mediumQueue.remove(jobId)
    return true
  } catch {
    return false
  }
}

async function enqueueEsSync<K extends JobName>(
  name: K,
  payload: JobPayloadMap[K],
  entityId: string,
): Promise<void> {
  await enqueue(name, payload, {
    jobId: `${name}__${entityId}`,
    removeOnComplete: true,
    removeOnFail: 100,
  })
}

export async function enqueueEsSyncPost(postId: string): Promise<void> {
  await enqueueEsSync("es-sync-post", { postId }, postId)
}

export async function enqueueEsSyncComment(commentId: string): Promise<void> {
  await enqueueEsSync("es-sync-comment", { commentId }, commentId)
}

export async function enqueueEsSyncCommunity(communityId: string): Promise<void> {
  await enqueueEsSync("es-sync-community", { communityId }, communityId)
}

export async function enqueueEsSyncUser(userId: string): Promise<void> {
  await enqueueEsSync("es-sync-user", { userId }, userId)
}

export async function enqueueEsBackfill(): Promise<void> {
  await enqueue(
    "es-backfill",
    {},
    { jobId: "es-backfill", removeOnComplete: true, removeOnFail: 100 },
  )
}

export function linkPreviewFetchJobId(postId: string): string {
  return `link-preview-fetch__${postId}`
}

export async function enqueueLinkPreviewFetch(postId: string, linkUrl: string): Promise<void> {
  await enqueue(
    "link-preview-fetch",
    { postId, linkUrl },
    {
      jobId: linkPreviewFetchJobId(postId),
      removeOnComplete: true,
      removeOnFail: 100,
    },
  )
}

const RISING_RECOMPUTE_INTERVAL_MS = 90 * 1000
const RECURRING_POST_SCHEDULER_INTERVAL_MS = 15 * 60 * 1000
const DRAFT_EXPIRY_INTERVAL_MS = 24 * 60 * 60 * 1000

// Registers all recurring schedulers. Idempotent — `upsertJobScheduler` reconciles the
// schedule on every boot, so calling this on every worker start is safe.
export async function registerRepeatables(): Promise<void> {
  await mediumQueue.upsertJobScheduler(
    "rising-recompute",
    { every: RISING_RECOMPUTE_INTERVAL_MS },
    { name: "rising-recompute", data: {} },
  )
  await mediumQueue.upsertJobScheduler(
    "recurring-post-scheduler",
    { every: RECURRING_POST_SCHEDULER_INTERVAL_MS },
    { name: "recurring-post-scheduler", data: {} },
  )
  await slowQueue.upsertJobScheduler(
    "draft-expiry",
    { every: DRAFT_EXPIRY_INTERVAL_MS },
    { name: "draft-expiry", data: {} },
  )
}
