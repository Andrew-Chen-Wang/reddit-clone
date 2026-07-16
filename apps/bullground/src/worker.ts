import {
  connection,
  fastQueue,
  type JobPayloadMap,
  mediumQueue,
  registerRepeatables,
  slowQueue,
} from "@utils/queues"
import { type Job, Worker } from "bullmq"
import { processDraftExpiry } from "./jobs/draftExpiry"
import { processEsBackfill } from "./jobs/esBackfill"
import { processLinkPreviewFetch } from "./jobs/linkPreviewFetch"
import {
  processEsSyncComment,
  processEsSyncCommunity,
  processEsSyncPost,
  processEsSyncUser,
} from "./jobs/esSync"
import { processMediaCleanup } from "./jobs/mediaCleanup"
import { processRecurringPostScheduler } from "./jobs/recurringPostScheduler"
import { processRisingRecompute } from "./jobs/risingRecompute"
import { processScheduledPostPublish } from "./jobs/scheduledPostPublish"
import { ensureSearchIndexes } from "@template-nextjs/search"

// This process runs the cloud workers (fast/medium/slow). Each worker dispatches on
// job.name; new milestones add cases here and the matching payload type in @utils/queues.

function makeFastWorker() {
  return new Worker(
    "fast",
    async (job) => {
      console.info(`[fast] starting ${job.name} (id=${job.id})`)
      if (job.name === "es-sync-post") {
        await processEsSyncPost(job.data as JobPayloadMap["es-sync-post"])
      }
      if (job.name === "es-sync-comment") {
        await processEsSyncComment(job.data as JobPayloadMap["es-sync-comment"])
      }
      if (job.name === "es-sync-community") {
        await processEsSyncCommunity(job.data as JobPayloadMap["es-sync-community"])
      }
      if (job.name === "es-sync-user") {
        await processEsSyncUser(job.data as JobPayloadMap["es-sync-user"])
      }
    },
    { connection, concurrency: 10, removeOnComplete: { age: 86400 } },
  )
}

function makeMediumWorker() {
  return new Worker(
    "medium",
    async (job) => {
      console.info(`[medium] starting ${job.name} (id=${job.id})`)
      if (job.name === "rising-recompute") {
        await processRisingRecompute(job.data as JobPayloadMap["rising-recompute"])
      }
      if (job.name === "scheduled-post-publish") {
        await processScheduledPostPublish(job.data as JobPayloadMap["scheduled-post-publish"])
      }
      if (job.name === "recurring-post-scheduler") {
        await processRecurringPostScheduler(job.data as JobPayloadMap["recurring-post-scheduler"])
      }
    },
    { connection, concurrency: 5, removeOnComplete: { age: 86400 } },
  )
}

function makeSlowWorker() {
  return new Worker(
    "slow",
    async (job) => {
      console.info(`[slow] starting ${job.name} (id=${job.id})`)
      if (job.name === "media-cleanup") {
        await processMediaCleanup(job as Job<JobPayloadMap["media-cleanup"]>)
      }
      if (job.name === "draft-expiry") {
        await processDraftExpiry(job.data as JobPayloadMap["draft-expiry"])
      }
      if (job.name === "es-backfill") {
        await processEsBackfill(job.data as JobPayloadMap["es-backfill"])
      }
      if (job.name === "link-preview-fetch") {
        await processLinkPreviewFetch(job.data as JobPayloadMap["link-preview-fetch"])
      }
    },
    { connection, concurrency: 5, removeOnComplete: { age: 86400 } },
  )
}

const workers: [string, Worker][] = [
  ["fast", makeFastWorker()],
  ["medium", makeMediumWorker()],
  ["slow", makeSlowWorker()],
]

await registerRepeatables()
await ensureSearchIndexes().catch((err: unknown) => {
  console.error("[boot] ensureSearchIndexes failed:", err)
})

for (const [name, worker] of workers) {
  worker.on("failed", (job, err) => {
    console.error(`[${name}] job failed name=${job?.name} id=${job?.id}:`, err)
  })
  worker.on("error", (err) => {
    console.error(`[${name}] worker error:`, err)
  })
}

let shuttingDown = false

function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) {
    return
  }
  shuttingDown = true

  const shutdownTimeoutMs = Number(process.env.SHUTDOWN_TIMEOUT_MS ?? "570000")
  const timeout = setTimeout(() => {
    console.error(`${signal} shutdown timed out after ${shutdownTimeoutMs}ms`)
    process.exit(1)
  }, shutdownTimeoutMs)
  timeout.unref()

  async function close() {
    console.info(`${signal} signal received: closing queues`)
    await Promise.all([
      ...workers.map(([, worker]) => worker.close()),
      fastQueue.close(),
      mediumQueue.close(),
      slowQueue.close(),
    ])
    clearTimeout(timeout)
    console.info("All closed")
    process.exit(0)
  }

  close().catch((err: unknown) => {
    clearTimeout(timeout)
    console.error("Shutdown failed:", err)
    process.exit(1)
  })
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)

console.info(`Bullground started with ${workers.map(([name]) => name).join(", ")} queue(s)`)
