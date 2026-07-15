import type { JobPayloadMap } from "@utils/queues"

// Stub — recomputes "rising" post rankings. M3 fills in the actual logic once posts and
// votes exist.
export function processRisingRecompute(_data: JobPayloadMap["rising-recompute"]): Promise<void> {
  console.info("[rising-recompute] stub — recompute logic lands in M3")
  return Promise.resolve()
}
