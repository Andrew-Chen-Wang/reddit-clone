import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"
import { v7 } from "uuid"

interface CreateInviteInput {
  communityId: string
  inviteeUserId: string
  invitedByUserId: string | null
  permEverything?: boolean
  permUsers?: boolean
  permConfig?: boolean
  permFlair?: boolean
  permMail?: boolean
  permPostsComments?: boolean
  permWiki?: boolean
}

export function crudCommunityModeratorInvite(db: Kysely<DB>) {
  async function create(
    input: CreateInviteInput,
  ): Promise<Selectable<DB["communityModeratorInvite"]>> {
    return await db
      .insertInto("communityModeratorInvite")
      .values({
        id: v7(),
        communityId: input.communityId,
        inviteeUserId: input.inviteeUserId,
        invitedByUserId: input.invitedByUserId,
        permEverything: input.permEverything ?? false,
        permUsers: input.permUsers ?? false,
        permConfig: input.permConfig ?? false,
        permFlair: input.permFlair ?? false,
        permMail: input.permMail ?? false,
        permPostsComments: input.permPostsComments ?? false,
        permWiki: input.permWiki ?? false,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  async function resolve(id: string, status: string): Promise<boolean> {
    const result = await db
      .updateTable("communityModeratorInvite")
      .set({ status, resolvedAt: new Date() })
      .where("id", "=", id)
      .where("status", "=", "pending")
      .executeTakeFirst()
    return (result.numUpdatedRows ?? 0n) > 0n
  }

  return { create, resolve }
}
