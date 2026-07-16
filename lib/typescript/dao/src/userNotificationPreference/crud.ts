import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"
import type { NotificationLevel, NotificationType } from "../notification/types"

export function crudUserNotificationPreference(db: Kysely<DB>) {
  async function upsert(
    userId: string,
    type: NotificationType,
    level: NotificationLevel,
  ): Promise<void> {
    await db
      .insertInto("userNotificationPreference")
      .values({ userId, type, level })
      .onConflict((oc) => oc.columns(["userId", "type"]).doUpdateSet({ level }))
      .execute()
  }

  return { upsert }
}
