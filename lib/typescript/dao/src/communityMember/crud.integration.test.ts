import { db } from "@template-nextjs/db"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { v7 } from "uuid"

import { crudCommunityMember } from "./crud"
import { fetchCommunityMember } from "./fetch"

declare const process: { env: Record<string, string | undefined> }

const suffix = v7().slice(0, 8)
const userId = v7()
const communityId = v7()

async function memberCount(): Promise<number> {
  const row = await db
    .selectFrom("community")
    .select("memberCount")
    .where("id", "=", communityId)
    .executeTakeFirstOrThrow()
  return row.memberCount
}

beforeAll(async () => {
  await db
    .insertInto("user")
    .values({
      id: userId,
      username: `member-test-${suffix}`,
      email: `member-test-${suffix}@example.invalid`,
    })
    .execute()

  await db
    .insertInto("community")
    .values({
      id: communityId,
      name: `membertest${suffix}`,
      description: "member count test",
      visibility: "public",
      memberCount: 0,
    })
    .execute()
})

afterAll(async () => {
  await db.deleteFrom("community").where("id", "=", communityId).execute()
  await db.deleteFrom("user").where("id", "=", userId).execute()
  await db.destroy()
})

describe.skipIf(process.env.CI === "true")("crudCommunityMember join/leave", () => {
  it("increments member count and records the membership on join", async () => {
    await crudCommunityMember(db).join(communityId, userId)

    expect(await memberCount()).toBe(1)
    const membership = await fetchCommunityMember(db).getOne(communityId, userId, ["id"])
    expect(membership).toBeDefined()
  })

  it("does not double-count a repeated join", async () => {
    await crudCommunityMember(db).join(communityId, userId)
    expect(await memberCount()).toBe(1)
  })

  it("decrements member count on leave", async () => {
    await crudCommunityMember(db).leave(communityId, userId)

    expect(await memberCount()).toBe(0)
    const membership = await fetchCommunityMember(db).getOne(communityId, userId, ["id"])
    expect(membership).toBeUndefined()
  })

  it("does not go below zero on a repeated leave", async () => {
    await crudCommunityMember(db).leave(communityId, userId)
    expect(await memberCount()).toBe(0)
  })
})
