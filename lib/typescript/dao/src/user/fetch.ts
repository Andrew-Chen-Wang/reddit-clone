import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"

export function fetchUser(db: Kysely<DB>) {
  async function getOne<T extends (keyof DB["user"])[]>(
    id: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["user"]>, T[number]> | undefined> {
    return await db.selectFrom("user").select(fields).where("id", "=", id).executeTakeFirst()
  }

  async function getOneByEmail<T extends (keyof DB["user"])[]>(
    email: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["user"]>, T[number]> | undefined> {
    return await db.selectFrom("user").select(fields).where("email", "=", email).executeTakeFirst()
  }

  async function getOneByUsername<T extends (keyof DB["user"])[]>(
    username: string,
    fields: T,
  ): Promise<Pick<Selectable<DB["user"]>, T[number]> | undefined> {
    return await db
      .selectFrom("user")
      .select(fields)
      .where((eb) => eb(eb.fn("lower", ["username"]), "=", username.toLowerCase()))
      .executeTakeFirst()
  }

  async function isUsernameTaken(username: string): Promise<boolean> {
    const row = await db
      .selectFrom("user")
      .select("id")
      .where((eb) => eb(eb.fn("lower", ["username"]), "=", username.toLowerCase()))
      .executeTakeFirst()
    return row !== undefined
  }

  return { getOne, getOneByEmail, getOneByUsername, isUsernameTaken }
}
