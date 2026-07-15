import type { Kysely } from "kysely"
import { v7 } from "uuid"

const TOPICS = [
  "Anime & Cosplay",
  "Art",
  "Business & Finance",
  "Collectibles & Other Hobbies",
  "Education & Career",
  "Fashion & Beauty",
  "Food & Drinks",
  "Games",
  "Health",
  "Home & Garden",
  "Humanities & Law",
  "Identity & Relationships",
  "Internet Culture",
  "Movies & TV",
  "Music",
  "Nature & Outdoors",
  "News & Politics",
  "Places & Travel",
  "Pop Culture",
  "Q&As & Stories",
  "Reading & Writing",
  "Sciences",
  "Spooky",
  "Sports",
  "Technology",
  "Vehicles",
  "Wellness",
  "Adult Content",
  "Mature Topics",
]

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export async function seed(db: Kysely<any>): Promise<void> {
  await db
    .insertInto("topic")
    .values(
      TOPICS.map((name, i) => ({
        id: v7(),
        name,
        slug: slugify(name),
        displayOrder: i,
      })),
    )
    .onConflict((oc) => oc.column("slug").doNothing())
    .execute()
}
