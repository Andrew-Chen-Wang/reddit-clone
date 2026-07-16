import { db } from "@template-nextjs/db"
import { v7 } from "uuid"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { crudWikiPage } from "./crud"
import { fetchWikiPage } from "./fetch"
import { fetchWikiRevision } from "../wikiRevision/fetch"

declare const process: { env: Record<string, string | undefined> }

const suffix = v7().slice(0, 8)
const authorId = v7()
const communityId = v7()

beforeAll(async () => {
  await db
    .insertInto("user")
    .values({ id: authorId, username: `wiki-${suffix}`, email: `wiki-${suffix}@example.invalid` })
    .execute()
  await db
    .insertInto("community")
    .values({
      id: communityId,
      name: `wikitest${suffix}`,
      description: "wiki test",
      visibility: "public",
      memberCount: 0,
    })
    .execute()
})

afterAll(async () => {
  await db.deleteFrom("community").where("id", "=", communityId).execute()
  await db.deleteFrom("user").where("id", "=", authorId).execute()
  await db.destroy()
})

describe.skipIf(process.env.CI === "true")("wiki revision chain", () => {
  it("creates a page with a first revision and points currentRevisionId at it", async () => {
    const page = await crudWikiPage(db).createWithRevision({
      communityId,
      slug: "index",
      title: "Index",
      bodyMd: "v1 body",
      authorUserId: authorId,
      note: "Created page",
    })

    expect(page.currentRevisionId).not.toBeNull()

    const view = await fetchWikiPage(db).getWithCurrentRevision(communityId, "index")
    expect(view?.bodyMd).toBe("v1 body")

    const revisions = await fetchWikiRevision(db).listForPage(page.id, 10)
    expect(revisions.length).toBe(1)
    expect(revisions[0].id).toBe(page.currentRevisionId)
  })

  it("moves the pointer to the newest revision on edit", async () => {
    const page = await fetchWikiPage(db).getOneByCommunitySlug(communityId, "index", ["id"])
    const first = await fetchWikiPage(db).getOne(page!.id, ["currentRevisionId"])

    const revision = await crudWikiPage(db).addRevision(page!.id, {
      bodyMd: "v2 body",
      authorUserId: authorId,
      note: "edit",
    })

    const after = await fetchWikiPage(db).getOne(page!.id, ["currentRevisionId"])
    expect(after?.currentRevisionId).toBe(revision.id)
    expect(after?.currentRevisionId).not.toBe(first?.currentRevisionId)

    const view = await fetchWikiPage(db).getWithCurrentRevision(communityId, "index")
    expect(view?.bodyMd).toBe("v2 body")
  })

  it("revert creates a new revision copying an old body and repoints current", async () => {
    const page = await fetchWikiPage(db).getOneByCommunitySlug(communityId, "index", ["id"])
    const revisions = await fetchWikiRevision(db).listForPage(page!.id, 10)
    // Oldest revision holds "v1 body".
    const oldest = revisions[revisions.length - 1]
    const source = await fetchWikiRevision(db).getOne(oldest.id, ["bodyMd"])
    expect(source?.bodyMd).toBe("v1 body")

    const reverted = await crudWikiPage(db).revert(
      page!.id,
      source!.bodyMd,
      authorId,
      "Reverted to an earlier revision",
    )

    const after = await fetchWikiPage(db).getOne(page!.id, ["currentRevisionId"])
    expect(after?.currentRevisionId).toBe(reverted.id)

    const view = await fetchWikiPage(db).getWithCurrentRevision(communityId, "index")
    expect(view?.bodyMd).toBe("v1 body")

    const finalRevisions = await fetchWikiRevision(db).listForPage(page!.id, 10)
    expect(finalRevisions.length).toBe(3)
    expect(finalRevisions[0].id).toBe(reverted.id)
  })
})
