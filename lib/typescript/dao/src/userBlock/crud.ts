import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export function crudUserBlock(db: Kysely<DB>) {
  async function block(blockerUserId: string, blockedUserId: string): Promise<void> {
    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto("userBlock")
        .values({ blockerUserId, blockedUserId })
        .onConflict((oc) => oc.columns(["blockerUserId", "blockedUserId"]).doNothing())
        .execute()

      await trx
        .deleteFrom("userFollow")
        .where((eb) =>
          eb.or([
            eb.and([
              eb("followerUserId", "=", blockerUserId),
              eb("followedUserId", "=", blockedUserId),
            ]),
            eb.and([
              eb("followerUserId", "=", blockedUserId),
              eb("followedUserId", "=", blockerUserId),
            ]),
          ]),
        )
        .execute()
    })
  }

  async function unblock(blockerUserId: string, blockedUserId: string): Promise<boolean> {
    const result = await db
      .deleteFrom("userBlock")
      .where("blockerUserId", "=", blockerUserId)
      .where("blockedUserId", "=", blockedUserId)
      .executeTakeFirst()
    return (result.numDeletedRows ?? 0n) > 0n
  }

  return { block, unblock }
}
