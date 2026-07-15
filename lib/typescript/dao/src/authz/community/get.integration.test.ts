import { db } from "@template-nextjs/db"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { v7 } from "uuid"

import { getCommunityAuthz } from "./get"

declare const process: { env: Record<string, string | undefined> }

const suffix = v7().slice(0, 8)
const nonMemberId = v7()
const memberId = v7()
const modConfigId = v7()
const modEverythingId = v7()
const privateCommunityId = v7()
const publicCommunityId = v7()

const userIds = [nonMemberId, memberId, modConfigId, modEverythingId]

beforeAll(async () => {
  await db
    .insertInto("user")
    .values([
      {
        id: nonMemberId,
        username: `authz-nm-${suffix}`,
        email: `authz-nm-${suffix}@example.invalid`,
      },
      { id: memberId, username: `authz-m-${suffix}`, email: `authz-m-${suffix}@example.invalid` },
      {
        id: modConfigId,
        username: `authz-mc-${suffix}`,
        email: `authz-mc-${suffix}@example.invalid`,
      },
      {
        id: modEverythingId,
        username: `authz-me-${suffix}`,
        email: `authz-me-${suffix}@example.invalid`,
      },
    ])
    .execute()

  await db
    .insertInto("community")
    .values([
      {
        id: privateCommunityId,
        name: `authzpriv${suffix}`,
        description: "private community",
        visibility: "private",
        createdByUserId: modEverythingId,
        memberCount: 3,
      },
      {
        id: publicCommunityId,
        name: `authzpub${suffix}`,
        description: "public community",
        visibility: "public",
        createdByUserId: modEverythingId,
        memberCount: 0,
      },
    ])
    .execute()

  await db
    .insertInto("communityMember")
    .values([
      { id: v7(), communityId: privateCommunityId, userId: memberId },
      { id: v7(), communityId: privateCommunityId, userId: modConfigId },
      { id: v7(), communityId: privateCommunityId, userId: modEverythingId },
    ])
    .execute()

  await db
    .insertInto("communityModerator")
    .values([
      {
        id: v7(),
        communityId: privateCommunityId,
        userId: modEverythingId,
        position: 0,
        permEverything: true,
      },
      {
        id: v7(),
        communityId: privateCommunityId,
        userId: modConfigId,
        position: 1,
        permConfig: true,
      },
    ])
    .execute()
})

afterAll(async () => {
  await db
    .deleteFrom("community")
    .where("id", "in", [privateCommunityId, publicCommunityId])
    .execute()
  await db.deleteFrom("user").where("id", "in", userIds).execute()
  await db.destroy()
})

describe.skipIf(process.env.CI === "true")("getCommunityAuthz", () => {
  it("hides a private community from a non-member", async () => {
    const result = await getCommunityAuthz(db).canView(privateCommunityId, nonMemberId)
    expect(result.ok).toBe(false)
  })

  it("hides a private community from an anonymous viewer", async () => {
    const result = await getCommunityAuthz(db).canView(privateCommunityId, null)
    expect(result.ok).toBe(false)
  })

  it("shows a private community to a member", async () => {
    const result = await getCommunityAuthz(db).canView(privateCommunityId, memberId)
    expect(result.ok).toBe(true)
  })

  it("shows a public community to an anonymous viewer", async () => {
    const result = await getCommunityAuthz(db).canView(publicCommunityId, null)
    expect(result.ok).toBe(true)
  })

  it("grants a permEverything moderator any permission", async () => {
    const result = await getCommunityAuthz(db).canModerate(
      privateCommunityId,
      modEverythingId,
      "users",
    )
    expect(result.ok).toBe(true)
  })

  it("grants a scoped moderator only the matching permission", async () => {
    const config = await getCommunityAuthz(db).canModerate(
      privateCommunityId,
      modConfigId,
      "config",
    )
    const users = await getCommunityAuthz(db).canModerate(privateCommunityId, modConfigId, "users")
    expect(config.ok).toBe(true)
    expect(users.ok).toBe(false)
  })

  it("denies a member who is not a moderator", async () => {
    const result = await getCommunityAuthz(db).canModerate(privateCommunityId, memberId)
    expect(result.ok).toBe(false)
  })
})
