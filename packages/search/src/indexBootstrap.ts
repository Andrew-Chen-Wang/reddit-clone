import type { IndicesIndexSettings, MappingTypeMapping } from "@elastic/elasticsearch/lib/api/types"
import { client } from "./client"

export interface IndexDefinition {
  index: string
  mappings: MappingTypeMapping
  settings?: IndicesIndexSettings
}

// Creates an index with its mapping if it does not already exist. Idempotent — safe to
// call on every boot. Mappings are effectively immutable in ES, so an existing index is
// left untouched (a mapping change requires a reindex, handled per-index when it lands).
export async function ensureIndex(def: IndexDefinition): Promise<void> {
  const exists = await client.indices.exists({ index: def.index })
  if (exists) {
    return
  }
  await client.indices.create({
    index: def.index,
    mappings: def.mappings,
    settings: def.settings,
  })
}

export async function ensureIndexes(defs: IndexDefinition[]): Promise<void> {
  for (const def of defs) {
    await ensureIndex(def)
  }
}
