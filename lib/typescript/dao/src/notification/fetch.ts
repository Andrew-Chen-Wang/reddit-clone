import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

export interface NotificationCursor {
  createdAt: Date
  id: string
}

export function fetchNotification(db: Kysely<DB>) {
  async function list(
    userId: string,
    opts: { before?: NotificationCursor | null; limit: number },
  ): Promise<Selectable<DB["notification"]>[]> {
    let q = db
      .selectFrom("notification")
      .selectAll()
      .where("userId", "=", userId)
      .where("archivedAt", "is", null)
    if (opts.before) {
      const before = opts.before
      q = q.where((eb) =>
        eb.or([
          eb("createdAt", "<", before.createdAt),
          eb.and([eb("createdAt", "=", before.createdAt), eb("id", "<", before.id)]),
        ]),
      )
    }
    return await q.orderBy("createdAt", "desc").orderBy("id", "desc").limit(opts.limit).execute()
  }

  async function getOne<T extends (keyof DB["notification"])[]>(
    id: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["notification"]>, T[number]> | undefined> {
    return await db
      .selectFrom("notification")
      .select(fields)
      .where("id", "=", id)
      .executeTakeFirst()
  }

  async function unreadCount(userId: string): Promise<number> {
    const row = await db
      .selectFrom("notification")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("userId", "=", userId)
      .where("readAt", "is", null)
      .where("archivedAt", "is", null)
      .executeTakeFirstOrThrow()
    return Number(row.count)
  }

  return { list, getOne, unreadCount }
}
