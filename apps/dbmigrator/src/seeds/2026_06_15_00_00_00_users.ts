import type { Kysely } from "kysely"
import { v7 } from "uuid"

interface SeedUser {
  name: string
  email: string
  username: string
  isAdmin?: boolean
}

const USERS: SeedUser[] = [
  {
    name: "ReadIt Admin",
    email: "readit-admin@dev.local",
    username: "readit-admin",
    isAdmin: true,
  },
  { name: "Alice Anderson", email: "alice@dev.local", username: "alice" },
  { name: "Bob Brown", email: "bob@dev.local", username: "bob" },
  { name: "Carol Chen", email: "carol@dev.local", username: "carol" },
  { name: "Dave Diaz", email: "dave@dev.local", username: "dave" },
  { name: "Erin Evans", email: "erin@dev.local", username: "erin" },
  { name: "Frank Fisher", email: "frank@dev.local", username: "frank" },
]

export async function seed(db: Kysely<any>): Promise<void> {
  await db
    .insertInto("user")
    .values(
      USERS.map((u) => ({
        id: v7(),
        name: u.name,
        email: u.email,
        username: u.username,
        isAdmin: u.isAdmin ?? false,
      })),
    )
    .onConflict((oc) => oc.column("email").doNothing())
    .execute()
}
