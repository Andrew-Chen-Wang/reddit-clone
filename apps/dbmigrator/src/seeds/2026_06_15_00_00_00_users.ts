import type { Kysely } from "kysely"
import { v7 } from "uuid"

interface SeedUser {
  name: string
  email: string
  isAdmin?: boolean
}

const USERS: SeedUser[] = [
  { name: "ReadIt Admin", email: "readit-admin@dev.local", isAdmin: true },
  { name: "Alice Anderson", email: "alice@dev.local" },
  { name: "Bob Brown", email: "bob@dev.local" },
  { name: "Carol Chen", email: "carol@dev.local" },
  { name: "Dave Diaz", email: "dave@dev.local" },
  { name: "Erin Evans", email: "erin@dev.local" },
  { name: "Frank Fisher", email: "frank@dev.local" },
]

export async function seed(db: Kysely<any>): Promise<void> {
  await db
    .insertInto("user")
    .values(
      USERS.map((u) => ({
        id: v7(),
        name: u.name,
        email: u.email,
        isAdmin: u.isAdmin ?? false,
      })),
    )
    .onConflict((oc) => oc.column("email").doNothing())
    .execute()
}
