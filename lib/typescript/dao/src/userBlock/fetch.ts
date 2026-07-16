import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export function fetchUserBlock(db: Kysely<DB>) {
  async function isBlocked(blockerUserId: string, blockedUserId: string): Promise<boolean> {
    const row = await db
      .selectFrom("userBlock")
      .select("blockedUserId")
      .where("blockerUserId", "=", blockerUserId)
      .where("blockedUserId", "=", blockedUserId)
      .executeTakeFirst()
    return row !== undefined
  }

  async function isBlockedEither(userA: string, userB: string): Promise<boolean> {
    const row = await db
      .selectFrom("userBlock")
      .select("blockedUserId")
      .where((eb) =>
        eb.or([
          eb.and([eb("blockerUserId", "=", userA), eb("blockedUserId", "=", userB)]),
          eb.and([eb("blockerUserId", "=", userB), eb("blockedUserId", "=", userA)]),
        ]),
      )
      .executeTakeFirst()
    return row !== undefined
  }

  async function count(userId: string): Promise<number> {
    const row = await db
      .selectFrom("userBlock")
      .where("blockerUserId", "=", userId)
      .select((eb) => eb.fn.count<string>("blockedUserId").as("count"))
      .executeTakeFirstOrThrow()
    return Number(row.count)
  }

  async function listBlockedIds(userId: string): Promise<string[]> {
    const rows = await db
      .selectFrom("userBlock")
      .select("blockedUserId")
      .where("blockerUserId", "=", userId)
      .execute()
    return rows.map((r) => r.blockedUserId)
  }

  async function listBlockedEitherIds(userId: string): Promise<string[]> {
    const rows = await db
      .selectFrom("userBlock")
      .select(["blockerUserId", "blockedUserId"])
      .where((eb) => eb.or([eb("blockerUserId", "=", userId), eb("blockedUserId", "=", userId)]))
      .execute()
    const ids = new Set<string>()
    for (const row of rows) {
      ids.add(row.blockerUserId === userId ? row.blockedUserId : row.blockerUserId)
    }
    return [...ids]
  }

  async function listMine(userId: string) {
    return await db
      .selectFrom("userBlock")
      .innerJoin("user", "user.id", "userBlock.blockedUserId")
      .where("userBlock.blockerUserId", "=", userId)
      .select([
        "user.id as id",
        "user.username as username",
        "user.displayName as displayName",
        "user.avatarImageKey as avatarImageKey",
        "userBlock.createdAt as createdAt",
      ])
      .orderBy("userBlock.createdAt", "desc")
      .execute()
  }

  return {
    isBlocked,
    isBlockedEither,
    count,
    listBlockedIds,
    listBlockedEitherIds,
    listMine,
  }
}
