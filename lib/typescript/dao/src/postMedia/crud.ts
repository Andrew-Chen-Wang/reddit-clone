import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable, Updateable } from "kysely"
import { v7 } from "uuid"

interface CreatePostMediaItem {
  position: number
  mediaType: string
  s3Key: string
  mimeType?: string | null
  byteSize?: number | null
  width?: number | null
  height?: number | null
}

interface MarkCompletedEntry {
  s3Key: string
  width?: number | null
  height?: number | null
  byteSize?: number | null
}

export function crudPostMedia(db: Kysely<DB>) {
  async function createMany(
    postId: string,
    items: CreatePostMediaItem[],
  ): Promise<Selectable<DB["postMedia"]>[]> {
    if (items.length === 0) return []
    return await db
      .insertInto("postMedia")
      .values(
        items.map((item) => ({
          id: v7(),
          postId,
          position: item.position,
          mediaType: item.mediaType,
          s3Key: item.s3Key,
          mimeType: item.mimeType ?? null,
          byteSize: item.byteSize ?? null,
          width: item.width ?? null,
          height: item.height ?? null,
          uploadStatus: "pending",
        })),
      )
      .returningAll()
      .execute()
  }

  async function markCompleted(postId: string, entries: MarkCompletedEntry[]): Promise<void> {
    if (entries.length === 0) return
    await db.transaction().execute(async (trx) => {
      for (const entry of entries) {
        const set: Updateable<DB["postMedia"]> = { uploadStatus: "completed" }
        if (entry.width !== undefined) set.width = entry.width
        if (entry.height !== undefined) set.height = entry.height
        if (entry.byteSize !== undefined) set.byteSize = entry.byteSize
        await trx
          .updateTable("postMedia")
          .set(set)
          .where("postId", "=", postId)
          .where("s3Key", "=", entry.s3Key)
          .execute()
      }
    })
  }

  async function deletePendingByPost(postId: string): Promise<number> {
    const result = await db
      .deleteFrom("postMedia")
      .where("postId", "=", postId)
      .where("uploadStatus", "=", "pending")
      .executeTakeFirst()
    return Number(result.numDeletedRows ?? 0n)
  }

  async function deleteByPost(postId: string): Promise<number> {
    const result = await db.deleteFrom("postMedia").where("postId", "=", postId).executeTakeFirst()
    return Number(result.numDeletedRows ?? 0n)
  }

  return { createMany, markCompleted, deletePendingByPost, deleteByPost }
}
