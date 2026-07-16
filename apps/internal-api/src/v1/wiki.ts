import { getCommunityAuthz } from "@lib/dao/authz/community/get"
import { fetchCommunity } from "@lib/dao/community/fetch"
import { crudWikiPage } from "@lib/dao/wikiPage/crud"
import { fetchWikiPage } from "@lib/dao/wikiPage/fetch"
import { fetchWikiRevision } from "@lib/dao/wikiRevision/fetch"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware, authNoThrowMiddleware } from "../middleware"
import { EmptyObject, ErrorSchemaResponse } from "../utils/common.serializer"
import { ErrorCode } from "../utils/errors.enum"
import { throwBadRequest, throwForbidden, throwNotFound } from "../utils/http-exception"
import {
  wikiCommunitySchemaParam,
  wikiCreateSchemaRequest,
  wikiCreateSchemaResponse,
  wikiIndexSchemaResponse,
  wikiPageSchemaParam,
  wikiPageSchemaResponse,
  wikiRevertSchemaRequest,
  wikiRevisionsSchemaResponse,
  wikiUpdateSchemaRequest,
} from "./wiki.serializer"

const REVISION_LIMIT = 100

function normalizeSlug(slug: string): string {
  return slug
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9/]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

const app = new Hono()
  .get(
    "/:communityName",
    authNoThrowMiddleware,
    describeRoute({
      description: "List a community's wiki pages",
      responses: {
        200: {
          description: "Wiki page index",
          content: { "application/json": { schema: resolver(wikiIndexSchemaResponse) } },
        },
        404: {
          description: "Community not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", wikiCommunitySchemaParam),
    async (c) => {
      const user = c.var.user
      const { communityName } = c.req.valid("param")

      const community = await fetchCommunity(db).getOneByName(communityName, ["id", "visibility"])
      if (!community) return throwNotFound(c, "Community not found")

      const view = await getCommunityAuthz(db).canView(
        { id: community.id, visibility: community.visibility },
        user?.id ?? null,
      )
      if (!view.ok) return throwNotFound(c, "Community not found")

      const canEdit = user
        ? (await getCommunityAuthz(db).canModerate(community.id, user.id, "wiki")).ok
        : false

      const pages = await fetchWikiPage(db).listForCommunity(community.id)
      return c.json({ canEdit, data: pages })
    },
  )
  .get(
    "/:communityName/:slug",
    authNoThrowMiddleware,
    describeRoute({
      description: "Get a wiki page with its current revision",
      responses: {
        200: {
          description: "Wiki page",
          content: { "application/json": { schema: resolver(wikiPageSchemaResponse) } },
        },
        404: {
          description: "Page not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", wikiPageSchemaParam),
    async (c) => {
      const user = c.var.user
      const { communityName, slug } = c.req.valid("param")

      const community = await fetchCommunity(db).getOneByName(communityName, ["id", "visibility"])
      if (!community) return throwNotFound(c, "Page not found")

      const view = await getCommunityAuthz(db).canView(
        { id: community.id, visibility: community.visibility },
        user?.id ?? null,
      )
      if (!view.ok) return throwNotFound(c, "Page not found")

      const page = await fetchWikiPage(db).getWithCurrentRevision(community.id, slug)
      if (!page) return throwNotFound(c, "Page not found")

      const canEdit = user
        ? (await getCommunityAuthz(db).canModerate(community.id, user.id, "wiki")).ok
        : false

      return c.json({
        id: page.id,
        slug: page.slug,
        title: page.title,
        bodyMd: page.bodyMd,
        currentRevisionId: page.currentRevisionId,
        canEdit,
        updatedAt: page.revisionCreatedAt ? page.revisionCreatedAt.toISOString() : null,
        author: page.revisionAuthorUsername ? { username: page.revisionAuthorUsername } : null,
      })
    },
  )
  .get(
    "/:communityName/:slug/revisions",
    authNoThrowMiddleware,
    describeRoute({
      description: "List a wiki page's revision history",
      responses: {
        200: {
          description: "Revision history",
          content: { "application/json": { schema: resolver(wikiRevisionsSchemaResponse) } },
        },
        404: {
          description: "Page not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", wikiPageSchemaParam),
    async (c) => {
      const user = c.var.user
      const { communityName, slug } = c.req.valid("param")

      const community = await fetchCommunity(db).getOneByName(communityName, ["id", "visibility"])
      if (!community) return throwNotFound(c, "Page not found")

      const view = await getCommunityAuthz(db).canView(
        { id: community.id, visibility: community.visibility },
        user?.id ?? null,
      )
      if (!view.ok) return throwNotFound(c, "Page not found")

      const page = await fetchWikiPage(db).getOneByCommunitySlug(community.id, slug, ["id"])
      if (!page) return throwNotFound(c, "Page not found")

      const revisions = await fetchWikiRevision(db).listForPage(page.id, REVISION_LIMIT)
      return c.json({
        data: revisions.map((r) => ({
          id: r.id,
          note: r.note,
          createdAt: r.createdAt.toISOString(),
          author: r.authorUsername ? { username: r.authorUsername } : null,
        })),
      })
    },
  )
  .use(authMiddleware)
  .post(
    "/:communityName",
    describeRoute({
      description: "Create a wiki page (moderators with wiki permission)",
      responses: {
        201: {
          description: "Page created",
          content: { "application/json": { schema: resolver(wikiCreateSchemaResponse) } },
        },
        400: {
          description: "A page with that slug already exists",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Community not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", wikiCommunitySchemaParam),
    validator("json", wikiCreateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { communityName } = c.req.valid("param")
      const body = c.req.valid("json")

      const community = await fetchCommunity(db).getOneByName(communityName, ["id"])
      if (!community) return throwNotFound(c, "Community not found")

      const moderate = await getCommunityAuthz(db).canModerate(community.id, user.id, "wiki")
      if (!moderate.ok) return throwForbidden(c, "You cannot manage this wiki")

      const slug = normalizeSlug(body.slug)
      if (slug === "") return throwBadRequest(c, "Invalid slug", ErrorCode.ValidationFailed)

      const existing = await fetchWikiPage(db).getOneByCommunitySlug(community.id, slug, ["id"])
      if (existing) {
        return throwBadRequest(
          c,
          "A page with that slug already exists",
          ErrorCode.ResourceAlreadyExists,
        )
      }

      const page = await crudWikiPage(db).createWithRevision({
        communityId: community.id,
        slug,
        title: body.title,
        bodyMd: body.body,
        authorUserId: user.id,
        note: "Created page",
      })

      return c.json({ id: page.id, slug: page.slug }, 201)
    },
  )
  .put(
    "/:communityName/:slug",
    describeRoute({
      description: "Save a new revision of a wiki page (moderators with wiki permission)",
      responses: {
        200: {
          description: "Revision saved",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Page not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", wikiPageSchemaParam),
    validator("json", wikiUpdateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { communityName, slug } = c.req.valid("param")
      const body = c.req.valid("json")

      const community = await fetchCommunity(db).getOneByName(communityName, ["id"])
      if (!community) return throwNotFound(c, "Page not found")

      const moderate = await getCommunityAuthz(db).canModerate(community.id, user.id, "wiki")
      if (!moderate.ok) return throwForbidden(c, "You cannot manage this wiki")

      const page = await fetchWikiPage(db).getOneByCommunitySlug(community.id, slug, ["id"])
      if (!page) return throwNotFound(c, "Page not found")

      await crudWikiPage(db).addRevision(page.id, {
        bodyMd: body.body,
        authorUserId: user.id,
        note: body.note ?? null,
      })
      return c.json({})
    },
  )
  .post(
    "/:communityName/:slug/revert",
    describeRoute({
      description: "Revert a wiki page to a prior revision (moderators with wiki permission)",
      responses: {
        200: {
          description: "Page reverted",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        404: {
          description: "Page or revision not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("param", wikiPageSchemaParam),
    validator("json", wikiRevertSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { communityName, slug } = c.req.valid("param")
      const body = c.req.valid("json")

      const community = await fetchCommunity(db).getOneByName(communityName, ["id"])
      if (!community) return throwNotFound(c, "Page not found")

      const moderate = await getCommunityAuthz(db).canModerate(community.id, user.id, "wiki")
      if (!moderate.ok) return throwForbidden(c, "You cannot manage this wiki")

      const page = await fetchWikiPage(db).getOneByCommunitySlug(community.id, slug, ["id"])
      if (!page) return throwNotFound(c, "Page not found")

      const source = await fetchWikiRevision(db).getOne(body.revisionId, ["wikiPageId", "bodyMd"])
      if (!source || source.wikiPageId !== page.id) return throwNotFound(c, "Revision not found")

      await crudWikiPage(db).revert(
        page.id,
        source.bodyMd,
        user.id,
        "Reverted to an earlier revision",
      )
      return c.json({})
    },
  )

export default app
