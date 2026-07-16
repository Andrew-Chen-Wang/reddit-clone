import type { DB } from "@template-nextjs/db"
import type { Kysely, Selectable } from "kysely"
import { v7 } from "uuid"

export const MAX_COMMENT_DEPTH = 1000

interface CreateCommentInput {
  postId: string
  parentCommentId?: string | null
  authorUserId: string
  bodyMd: string
}

export type CreateCommentResult =
  | { comment: Selectable<DB["comment"]> }
  | { error: "PARENT_NOT_FOUND" | "POST_MISMATCH" | "DEPTH_EXCEEDED" }

export type DeleteCommentResult = { mode: "hard" | "scrub" } | { error: "NOT_FOUND" | "FORBIDDEN" }

export function crudComment(db: Kysely<DB>) {
  async function create(input: CreateCommentInput): Promise<CreateCommentResult> {
    const id = v7()
    return await db.transaction().execute(async (trx): Promise<CreateCommentResult> => {
      let path: string[] = [id]
      let depth = 0

      if (input.parentCommentId) {
        const parent = await trx
          .selectFrom("comment")
          .select(["postId", "path", "depth"])
          .where("id", "=", input.parentCommentId)
          .executeTakeFirst()
        if (!parent) return { error: "PARENT_NOT_FOUND" }
        if (parent.postId !== input.postId) return { error: "POST_MISMATCH" }
        depth = parent.depth + 1
        if (depth > MAX_COMMENT_DEPTH) return { error: "DEPTH_EXCEEDED" }
        path = [...parent.path, id]
      }

      const comment = await trx
        .insertInto("comment")
        .values({
          id,
          postId: input.postId,
          parentCommentId: input.parentCommentId ?? null,
          path,
          depth,
          authorUserId: input.authorUserId,
          bodyMd: input.bodyMd,
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      await trx
        .updateTable("post")
        .set((eb) => ({ commentCount: eb("commentCount", "+", 1) }))
        .where("id", "=", input.postId)
        .execute()

      if (input.parentCommentId) {
        await trx
          .updateTable("comment")
          .set((eb) => ({ childCount: eb("childCount", "+", 1) }))
          .where("id", "=", input.parentCommentId)
          .execute()
      }

      return { comment }
    })
  }

  async function update(
    commentId: string,
    authorUserId: string,
    bodyMd: string,
  ): Promise<Selectable<DB["comment"]> | undefined> {
    return await db
      .updateTable("comment")
      .set({ bodyMd, editedAt: new Date() })
      .where("id", "=", commentId)
      .where("authorUserId", "=", authorUserId)
      .where("isDeleted", "=", false)
      .returningAll()
      .executeTakeFirst()
  }

  async function deleteOwn(commentId: string, authorUserId: string): Promise<DeleteCommentResult> {
    return await db.transaction().execute(async (trx): Promise<DeleteCommentResult> => {
      const comment = await trx
        .selectFrom("comment")
        .select(["postId", "parentCommentId", "authorUserId", "childCount"])
        .where("id", "=", commentId)
        .executeTakeFirst()
      if (!comment) return { error: "NOT_FOUND" }
      if (comment.authorUserId !== authorUserId) return { error: "FORBIDDEN" }

      if (comment.childCount > 0) {
        await trx
          .updateTable("comment")
          .set({ isDeleted: true, authorUserId: null, bodyMd: null })
          .where("id", "=", commentId)
          .execute()
        return { mode: "scrub" }
      }

      await trx.deleteFrom("comment").where("id", "=", commentId).execute()
      await trx
        .updateTable("post")
        .set((eb) => ({ commentCount: eb("commentCount", "-", 1) }))
        .where("id", "=", comment.postId)
        .execute()
      if (comment.parentCommentId) {
        await trx
          .updateTable("comment")
          .set((eb) => ({ childCount: eb("childCount", "-", 1) }))
          .where("id", "=", comment.parentCommentId)
          .execute()
      }
      return { mode: "hard" }
    })
  }

  async function setSticky(commentId: string, isSticky: boolean): Promise<boolean> {
    return await db.transaction().execute(async (trx) => {
      const comment = await trx
        .selectFrom("comment")
        .select(["postId"])
        .where("id", "=", commentId)
        .executeTakeFirst()
      if (!comment) return false
      if (isSticky) {
        await trx
          .updateTable("comment")
          .set({ isSticky: false })
          .where("postId", "=", comment.postId)
          .where("isSticky", "=", true)
          .execute()
      }
      await trx.updateTable("comment").set({ isSticky }).where("id", "=", commentId).execute()
      return true
    })
  }

  async function modRemove(
    id: string,
    removedByUserId: string,
    removalReasonId: string | null,
    asSpam: boolean,
  ): Promise<boolean> {
    const result = await db
      .updateTable("comment")
      .set({
        removedAt: new Date(),
        removedByUserId,
        removalReasonId,
        isSpam: asSpam,
        approvedAt: null,
        approvedByUserId: null,
      })
      .where("id", "=", id)
      .executeTakeFirst()
    return (result.numUpdatedRows ?? 0n) > 0n
  }

  async function modApprove(id: string, approvedByUserId: string): Promise<boolean> {
    const result = await db
      .updateTable("comment")
      .set({
        removedAt: null,
        removedByUserId: null,
        removalReasonId: null,
        isSpam: false,
        approvedAt: new Date(),
        approvedByUserId,
      })
      .where("id", "=", id)
      .executeTakeFirst()
    return (result.numUpdatedRows ?? 0n) > 0n
  }

  return { create, update, deleteOwn, setSticky, modRemove, modApprove }
}
