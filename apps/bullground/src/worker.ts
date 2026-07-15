import {
  connection,
  fastQueue,
  type JobPayloadMap,
  mediumQueue,
  registerRepeatables,
  slowQueue,
} from "@utils/queues"
import { Worker } from "bullmq"
import { processRisingRecompute } from "./jobs/risingRecompute"

// This process runs the cloud workers (fast/medium/slow). Each worker dispatches on
// job.name; new milestones add cases here and the matching payload type in @utils/queues.

function makeFastWorker() {
  return new Worker(
    "fast",
    (job) => {
      console.info(`[fast] starting ${job.name} (id=${job.id})`)
      return Promise.resolve()
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
    },
    { connection, concurrency: 5, removeOnComplete: { age: 86400 } },
  )
}

function makeSlowWorker() {
  return new Worker(
    "slow",
    (job) => {
      console.info(`[slow] starting ${job.name} (id=${job.id})`)
      return Promise.resolve()
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
