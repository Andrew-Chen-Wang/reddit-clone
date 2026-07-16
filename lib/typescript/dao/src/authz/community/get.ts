import type { DB } from "@template-nextjs/db"
import type { Kysely } from "kysely"

export type AuthzResult = { ok: true } | { ok: false; reason: string }

export type ModPermission = "config" | "users" | "flair" | "mail" | "posts_comments" | "wiki"

type CommunityRef = string | { id: string; visibility: string }

export function getCommunityAuthz(db: Kysely<DB>) {
  async function isMember(communityId: string, userId: string): Promise<boolean> {
    const row = await db
      .selectFrom("communityMember")
      .where("communityId", "=", communityId)
      .where("userId", "=", userId)
      .select("id")
      .executeTakeFirst()
    return row !== undefined
  }

  async function isModerator(communityId: string, userId: string): Promise<boolean> {
    const row = await db
      .selectFrom("communityModerator")
      .where("communityId", "=", communityId)
      .where("userId", "=", userId)
      .select("id")
      .executeTakeFirst()
    return row !== undefined
  }

  async function isBanned(communityId: string, userId: string): Promise<boolean> {
    const now = new Date()
    const row = await db
      .selectFrom("communityBan")
      .where("communityId", "=", communityId)
      .where("userId", "=", userId)
      .where((eb) => eb.or([eb("expiresAt", "is", null), eb("expiresAt", ">", now)]))
      .select("id")
      .executeTakeFirst()
    return row !== undefined
  }

  async function isApproved(communityId: string, userId: string): Promise<boolean> {
    const row = await db
      .selectFrom("communityApprovedUser")
      .where("communityId", "=", communityId)
      .where("userId", "=", userId)
      .select("id")
      .executeTakeFirst()
    return row !== undefined
  }

  async function resolveCommunity(
    ref: CommunityRef,
  ): Promise<{ id: string; visibility: string } | undefined> {
    if (typeof ref !== "string") return ref
    return await db
      .selectFrom("community")
      .where("id", "=", ref)
      .select(["id", "visibility"])
      .executeTakeFirst()
  }

  async function canView(ref: CommunityRef, userId: string | null): Promise<AuthzResult> {
    const community = await resolveCommunity(ref)
    if (!community) return { ok: false, reason: "NOT_FOUND" }
    if (community.visibility === "public" || community.visibility === "restricted") {
      return { ok: true }
    }
    if (!userId) return { ok: false, reason: "PRIVATE" }
    if (await isModerator(community.id, userId)) return { ok: true }
    if (await isMember(community.id, userId)) return { ok: true }
    return { ok: false, reason: "PRIVATE" }
  }

  async function canPost(ref: CommunityRef, userId: string | null): Promise<AuthzResult> {
    if (!userId) return { ok: false, reason: "NOT_AUTHENTICATED" }
    const community = await resolveCommunity(ref)
    if (!community) return { ok: false, reason: "NOT_FOUND" }
    if (await isBanned(community.id, userId)) return { ok: false, reason: "BANNED" }
    if (community.visibility === "public") return { ok: true }
    if (await isMember(community.id, userId)) return { ok: true }
    if (await isApproved(community.id, userId)) return { ok: true }
    return { ok: false, reason: "NOT_A_MEMBER" }
  }

  async function canComment(ref: CommunityRef, userId: string | null): Promise<AuthzResult> {
    if (!userId) return { ok: false, reason: "NOT_AUTHENTICATED" }
    const community = await resolveCommunity(ref)
    if (!community) return { ok: false, reason: "NOT_FOUND" }
    if (await isBanned(community.id, userId)) return { ok: false, reason: "BANNED" }
    if (community.visibility === "public" || community.visibility === "restricted") {
      return { ok: true }
    }
    if (await isModerator(community.id, userId)) return { ok: true }
    if (await isMember(community.id, userId)) return { ok: true }
    return { ok: false, reason: "PRIVATE" }
  }

  async function canModerate(
    communityId: string,
    userId: string | null,
    permission?: ModPermission,
  ): Promise<AuthzResult> {
    if (!userId) return { ok: false, reason: "NOT_AUTHENTICATED" }
    const mod = await db
      .selectFrom("communityModerator")
      .where("communityId", "=", communityId)
      .where("userId", "=", userId)
      .select([
        "permEverything",
        "permConfig",
        "permUsers",
        "permFlair",
        "permMail",
        "permPostsComments",
        "permWiki",
      ])
      .executeTakeFirst()
    if (!mod) return { ok: false, reason: "NOT_A_MODERATOR" }
    if (mod.permEverything) return { ok: true }
    if (!permission) return { ok: true }
    const permMap: Record<ModPermission, boolean> = {
      config: mod.permConfig,
      users: mod.permUsers,
      flair: mod.permFlair,
      mail: mod.permMail,
      posts_comments: mod.permPostsComments,
      wiki: mod.permWiki,
    }
    if (permMap[permission]) return { ok: true }
    return { ok: false, reason: "INSUFFICIENT_PERMISSIONS" }
  }

  return {
    canView,
    canPost,
    canComment,
    canModerate,
    isMember,
    isModerator,
    isBanned,
    isApproved,
  }
}
