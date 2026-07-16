import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"
import {
  DEFAULT_NOTIFICATION_LEVEL,
  type NotificationLevel,
  type NotificationType,
  NOTIFICATION_TYPES,
} from "../notification/types"

export function fetchUserNotificationPreference(db: Kysely<DB>) {
  async function getLevel(
    userId: string,
    type: NotificationType,
  ): Promise<NotificationLevel | undefined> {
    const row = await db
      .selectFrom("userNotificationPreference")
      .select("level")
      .where("userId", "=", userId)
      .where("type", "=", type)
      .executeTakeFirst()
    return row?.level as NotificationLevel | undefined
  }

  async function listForUser(
    userId: string,
  ): Promise<{ type: NotificationType; level: NotificationLevel }[]> {
    const rows = await db
      .selectFrom("userNotificationPreference")
      .select(["type", "level"])
      .where("userId", "=", userId)
      .execute()
    const byType = new Map<string, string>()
    for (const row of rows) byType.set(row.type, row.level)
    return NOTIFICATION_TYPES.map((type) => ({
      type,
      level: (byType.get(type) as NotificationLevel | undefined) ?? DEFAULT_NOTIFICATION_LEVEL,
    }))
  }

  return { getLevel, listForUser }
}
