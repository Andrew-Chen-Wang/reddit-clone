import { crudPost } from "@lib/dao/post/crud"
import { fetchPost } from "@lib/dao/post/fetch"
import { crudPostMedia } from "@lib/dao/postMedia/crud"
import { fetchPostMedia } from "@lib/dao/postMedia/fetch"
import { db } from "@template-nextjs/db"
import { createMediaUploadPost, deleteFromS3, existsOnS3 } from "@utils/aws"
import { v7 } from "uuid"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

declare const process: { env: Record<string, string | undefined> }

const suffix = v7().slice(0, 8)
const authorId = v7()
const communityId = v7()
const mediaPostId = v7()
const textPostId = v7()

const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
)

beforeAll(async () => {
  await db
    .insertInto("user")
    .values({ id: authorId, username: `media-${suffix}`, email: `media-${suffix}@example.invalid` })
    .execute()

  await db
    .insertInto("community")
    .values({
      id: communityId,
      name: `mediatest${suffix}`,
      description: "media test",
      visibility: "public",
      memberCount: 0,
    })
    .execute()

  await crudPost(db).create({
    id: textPostId,
    authorUserId: authorId,
    communityId,
    type: "text",
    title: "a text post",
  })

  await crudPost(db).create({
    id: mediaPostId,
    authorUserId: authorId,
    communityId,
    type: "media",
    title: "a media post",
  })
})

afterAll(async () => {
  await db.deleteFrom("post").where("communityId", "=", communityId).execute()
  await db.deleteFrom("community").where("id", "=", communityId).execute()
  await db.deleteFrom("user").where("id", "=", authorId).execute()
  await db.destroy()
})

function communityFeedIds(): Promise<string[]> {
  return fetchPost(db)
    .communityFeed({ communityId, sort: "new", windowStart: null, excludeSticky: false })
    .execute()
    .then((rows) => rows.map((r) => r.id))
}

describe.skipIf(process.env.CI === "true")("postMedia DAO lifecycle and feed guard", () => {
  it("creates pending rows, hides the post from feeds, then reveals it once completed", async () => {
    const key0 = `post-media/${mediaPostId}/0-${v7()}.png`
    const key1 = `post-media/${mediaPostId}/1-${v7()}.png`

    await crudPostMedia(db).createMany(mediaPostId, [
      { position: 0, mediaType: "image", s3Key: key0, mimeType: "image/png", byteSize: 123 },
      { position: 1, mediaType: "image", s3Key: key1, mimeType: "image/png", byteSize: 456 },
    ])

    const pending = await fetchPostMedia(db).getManyByPost(mediaPostId, [
      "position",
      "s3Key",
      "uploadStatus",
    ])
    expect(pending.map((m) => m.position)).toEqual([0, 1])
    expect(pending.every((m) => m.uploadStatus === "pending")).toBe(true)

    const idsWhilePending = await communityFeedIds()
    expect(idsWhilePending).toContain(textPostId)
    expect(idsWhilePending).not.toContain(mediaPostId)

    await crudPostMedia(db).markCompleted(mediaPostId, [{ s3Key: key0, width: 1, height: 1 }])

    expect(await fetchPostMedia(db).countCompletedByPost(mediaPostId)).toBe(1)
    const completed = await fetchPostMedia(db).getCompletedByPosts(
      [mediaPostId],
      ["postId", "s3Key", "width"],
    )
    expect(completed).toHaveLength(1)
    expect(completed[0].s3Key).toBe(key0)
    expect(completed[0].width).toBe(1)

    const idsAfterConfirm = await communityFeedIds()
    expect(idsAfterConfirm).toContain(mediaPostId)
  })

  it("presigns, uploads to Garage, verifies via HeadObject, and deletes", async () => {
    const key = `post-media/${mediaPostId}/probe-${v7()}.png`
    const presigned = await createMediaUploadPost({
      key,
      contentType: "image/png",
      maxSizeBytes: 20 * 1024 * 1024,
    })

    const form = new FormData()
    for (const [field, value] of Object.entries(presigned.fields)) {
      form.append(field, value)
    }
    form.append("file", new Blob([PNG_1PX], { type: "image/png" }), "probe.png")

    const res = await fetch(presigned.url, { method: "POST", body: form })
    expect(res.status).toBeLessThan(300)

    expect(await existsOnS3(key)).toBe(true)

    await deleteFromS3(key)
    expect(await existsOnS3(key)).toBe(false)
  })
})
