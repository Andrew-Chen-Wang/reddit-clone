import { db } from "@template-nextjs/db"
import { v7 } from "uuid"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { crudPostDraft } from "./crud"
import { fetchPostDraft } from "./fetch"

declare const process: { env: Record<string, string | undefined> }

const suffix = v7().slice(0, 8)
const userId = v7()

beforeAll(async () => {
  await db
    .insertInto("user")
    .values({ id: userId, username: `draft-${suffix}`, email: `draft-${suffix}@example.invalid` })
    .execute()
})

afterAll(async () => {
  await db.deleteFrom("postDraft").where("userId", "=", userId).execute()
  await db.deleteFrom("user").where("id", "=", userId).execute()
  await db.destroy()
})

describe.skipIf(process.env.CI === "true")("post draft cap and listing", () => {
  it("creates drafts and counts them for cap enforcement, newest updated first", async () => {
    for (let i = 0; i < 20; i++) {
      await crudPostDraft(db).create({ userId, title: `draft ${i}`, bodyMd: `body ${i}` })
    }

    expect(await fetchPostDraft(db).countForUser(userId)).toBe(20)

    const list = await fetchPostDraft(db).listForUser(userId)
    expect(list.length).toBe(20)
    for (let i = 1; i < list.length; i++) {
      expect(list[i - 1].updatedAt.getTime()).toBeGreaterThanOrEqual(list[i].updatedAt.getTime())
    }
  })

  it("expires drafts older than the cutoff", async () => {
    const before = new Date(Date.now() + 60 * 1000)
    const deleted = await crudPostDraft(db).deleteExpired(before)
    expect(deleted).toBe(20)
    expect(await fetchPostDraft(db).countForUser(userId)).toBe(0)
  })
})
