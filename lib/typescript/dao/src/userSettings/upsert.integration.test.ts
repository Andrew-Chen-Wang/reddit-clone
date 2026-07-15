import { db } from "@template-nextjs/db"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { v7 } from "uuid"

import { crudUserSettings } from "./crud"

declare const process: { env: Record<string, string | undefined> }

const userId = v7()

beforeAll(async () => {
  await db
    .insertInto("user")
    .values({
      id: userId,
      username: `settings-test-${userId.slice(0, 8)}`,
      email: `settings-test-${userId.slice(0, 8)}@example.invalid`,
    })
    .execute()
})

afterAll(async () => {
  await db.deleteFrom("userSettings").where("userId", "=", userId).execute()
  await db.deleteFrom("user").where("id", "=", userId).execute()
  await db.destroy()
})

describe.skipIf(process.env.CI === "true")("crudUserSettings.upsert", () => {
  it("creates a row with defaults for unspecified fields on first upsert", async () => {
    const created = await crudUserSettings(db).upsert(userId, { displayMode: "dark" })

    expect(created.userId).toBe(userId)
    expect(created.displayMode).toBe("dark")
    expect(created.feedView).toBe("card")
    expect(created.blurMature).toBe(true)
    expect(created.chatRequestPolicy).toBe("everyone")
  })

  it("updates only the patched fields on a second upsert", async () => {
    const updated = await crudUserSettings(db).upsert(userId, {
      displayMode: "light",
      feedView: "compact",
    })

    expect(updated.userId).toBe(userId)
    expect(updated.displayMode).toBe("light")
    expect(updated.feedView).toBe("compact")
    expect(updated.blurMature).toBe(true)
  })
})
