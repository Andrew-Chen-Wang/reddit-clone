import type { DB } from "@template-nextjs/db"
import type { Kysely, Updateable } from "kysely"
import { v7 } from "uuid"

interface AddModeratorInput {
  communityId: string
  userId: string
  position: number
  permEverything?: boolean
  permUsers?: boolean
  permConfig?: boolean
  permFlair?: boolean
  permMail?: boolean
  permPostsComments?: boolean
  permWiki?: boolean
}

export function crudCommunityModerator(db: Kysely<DB>) {
  async function add(input: AddModeratorInput): Promise<void> {
    await db
      .insertInto("communityModerator")
      .values({
        id: v7(),
        communityId: input.communityId,
        userId: input.userId,
        position: input.position,
        permEverything: input.permEverything ?? false,
        permUsers: input.permUsers ?? false,
        permConfig: input.permConfig ?? false,
        permFlair: input.permFlair ?? false,
        permMail: input.permMail ?? false,
        permPostsComments: input.permPostsComments ?? false,
        permWiki: input.permWiki ?? false,
      })
      .execute()
  }

  async function remove(communityId: string, userId: string): Promise<void> {
    await db
      .deleteFrom("communityModerator")
      .where("communityId", "=", communityId)
      .where("userId", "=", userId)
      .execute()
  }

  async function updatePerms(
    communityId: string,
    userId: string,
    perms: Updateable<DB["communityModerator"]>,
  ): Promise<void> {
    await db
      .updateTable("communityModerator")
      .set(perms)
      .where("communityId", "=", communityId)
      .where("userId", "=", userId)
      .execute()
  }

  return { add, remove, updatePerms }
}
