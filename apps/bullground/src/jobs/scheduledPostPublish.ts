import { getCommunityAuthz } from "@lib/dao/authz/community/get"
import { crudPost } from "@lib/dao/post/crud"
import { crudScheduledPost } from "@lib/dao/scheduledPost/crud"
import { fetchScheduledPost } from "@lib/dao/scheduledPost/fetch"
import { db } from "@template-nextjs/db"
import type { JobPayloadMap } from "@utils/queues"

export async function processScheduledPostPublish(
  data: JobPayloadMap["scheduled-post-publish"],
): Promise<void> {
  const sp = await fetchScheduledPost(db).getOne(data.scheduledPostId, [
    "id",
    "authorUserId",
    "communityId",
    "type",
    "title",
    "bodyMd",
    "linkUrl",
    "isNsfw",
    "isSpoiler",
    "isOc",
    "flairTemplateId",
    "status",
  ])
  if (!sp || sp.status !== "scheduled") return

  if (sp.communityId) {
    const canPost = await getCommunityAuthz(db).canPost(sp.communityId, sp.authorUserId)
    if (!canPost.ok) {
      await crudScheduledPost(db).markCanceled(sp.id)
      console.info(`[scheduled-post-publish] canceled ${sp.id}: author can no longer post`)
      return
    }
  }

  const created = await crudPost(db).create({
    authorUserId: sp.authorUserId,
    communityId: sp.communityId ?? null,
    profileUserId: sp.communityId ? null : sp.authorUserId,
    type: sp.type,
    title: sp.title,
    bodyMd: sp.type === "text" ? (sp.bodyMd ?? null) : null,
    linkUrl: sp.type === "link" ? (sp.linkUrl ?? null) : null,
    isNsfw: sp.isNsfw,
    isSpoiler: sp.isSpoiler,
    isOc: sp.isOc,
    flairTemplateId: sp.communityId ? (sp.flairTemplateId ?? null) : null,
  })

  await crudScheduledPost(db).markPublished(sp.id, created.id)
  console.info(`[scheduled-post-publish] published ${sp.id} as post ${created.id}`)
}
