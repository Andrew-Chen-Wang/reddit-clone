import type { JobsOptions, Queue } from "bullmq"
import { mediumQueue } from "./queues"

// Maps each job name to its payload shape. New jobs are added here and wired into the
// worker switch in apps/bullground. `rising-recompute` is the seed job; M3 fills it in.
export interface JobPayloadMap {
  "rising-recompute": Record<string, never>
}

export type JobName = keyof JobPayloadMap

const jobQueues: { [K in JobName]: Queue } = {
  "rising-recompute": mediumQueue,
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

const RISING_RECOMPUTE_INTERVAL_MS = 90 * 1000

// Registers all recurring schedulers. Idempotent — `upsertJobScheduler` reconciles the
// schedule on every boot, so calling this on every worker start is safe.
export async function registerRepeatables(): Promise<void> {
  await mediumQueue.upsertJobScheduler(
    "rising-recompute",
    { every: RISING_RECOMPUTE_INTERVAL_MS },
    { name: "rising-recompute", data: {} },
  )
}
