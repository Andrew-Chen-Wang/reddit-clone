import path from "node:path"
import { fileURLToPath } from "node:url"
import type { ConnectionOptions } from "bullmq"
import dotenv from "dotenv"

const currentDir = path.dirname(fileURLToPath(import.meta.url))

dotenv.config({ path: `${currentDir}/../../../../../.env`, quiet: true })

// Valkey backs BullMQ only — there are no generic caching helpers here. BullMQ reads
// `url` and builds its own ioredis connection per queue/worker; `maxRetriesPerRequest`
// must be null for the blocking commands workers rely on.
export const connection: ConnectionOptions = {
  url: process.env.VALKEY_URL ?? "redis://localhost:6379",
  maxRetriesPerRequest: null,
}
