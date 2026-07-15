import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

export function fetchTopic(db: Kysely<DB>) {
  async function getMany<T extends (keyof DB["topic"])[]>(
    fields: T,
  ): Promise<Pick<Selectable<DB["topic"]>, T[number]>[]> {
    return await db.selectFrom("topic").select(fields).orderBy("displayOrder", "asc").execute()
  }

  return { getMany }
}
