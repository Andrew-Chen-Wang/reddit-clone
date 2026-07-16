import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export interface RisingRow {
  postId: string
  communityId: string
  score: number
}

const RISING_WINDOW_MS = 24 * 60 * 60 * 1000
const RISING_KEEP = 200

export function crudPostRising(db: Kysely<DB>) {
  async function replaceAll(rows: RisingRow[]): Promise<void> {
    await db.transaction().execute(async (trx) => {
      await trx.deleteFrom("postRising").execute()
      if (rows.length === 0) return
      await trx
        .insertInto("postRising")
        .values(
          rows.map((r) => ({
            postId: r.postId,
            communityId: r.communityId,
            score: r.score,
            computedAt: new Date(),
          })),
        )
        .execute()
    })
  }

  async function recomputeRising(): Promise<number> {
    const now = Date.now()
    const cutoff = new Date(now - RISING_WINDOW_MS)

    const candidates = await db
      .selectFrom("post")
      .select(["id", "communityId", "ups", "downs", "createdAt"])
      .where("removedAt", "is", null)
      .where("communityId", "is not", null)
      .where("createdAt", ">=", cutoff)
      .execute()

    const scored = candidates
      .filter((c): c is typeof c & { communityId: string } => c.communityId !== null)
      .map((c) => {
        const minutesOld = (now - c.createdAt.getTime()) / 60000
        const raw = (c.ups - c.downs) / (minutesOld + 2)
        return { postId: c.id, communityId: c.communityId, raw }
      })

    const maxByCommunity = new Map<string, number>()
    for (const s of scored) {
      const current = maxByCommunity.get(s.communityId) ?? Number.NEGATIVE_INFINITY
      if (s.raw > current) maxByCommunity.set(s.communityId, s.raw)
    }

    const normalized: RisingRow[] = []
    for (const s of scored) {
      const max = maxByCommunity.get(s.communityId) ?? 0
      if (max <= 0) continue
      normalized.push({ postId: s.postId, communityId: s.communityId, score: s.raw / max })
    }

    normalized.sort((a, b) => b.score - a.score)
    const top = normalized.slice(0, RISING_KEEP)

    await replaceAll(top)
    return top.length
  }

  return { replaceAll, recomputeRising }
}
