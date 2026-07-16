import { enqueueEsSyncUser } from "@utils/queues"
import { crudUserSettings } from "@lib/dao/userSettings/crud"
import { fetchUserSettings } from "@lib/dao/userSettings/fetch"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import type { Static } from "typebox"
import { authMiddleware } from "../middleware"
import { ErrorSchemaResponse } from "../utils/common.serializer"
import {
  userSettingsSchemaResponse,
  userSettingsUpdateSchemaRequest,
} from "./user-settings.serializer"

type UserSettingsResponse = Static<typeof userSettingsSchemaResponse>

const USER_SETTINGS_DEFAULTS: UserSettingsResponse = {
  displayMode: "auto",
  feedView: "card",
  chatRequestPolicy: "everyone",
  defaultMarkdownEditor: false,
  showMature: false,
  blurMature: true,
  allowFollows: true,
  showInSearch: true,
  showRecommendations: true,
  autoplayMedia: true,
  reduceMotion: false,
  openPostsNewTab: false,
  safeSearch: false,
  showFollowerCount: true,
}

const USER_SETTINGS_FIELDS = Object.keys(USER_SETTINGS_DEFAULTS) as (keyof UserSettingsResponse)[]

function toResponse(settings: UserSettingsResponse): UserSettingsResponse {
  return {
    displayMode: settings.displayMode,
    feedView: settings.feedView,
    chatRequestPolicy: settings.chatRequestPolicy,
    defaultMarkdownEditor: settings.defaultMarkdownEditor,
    showMature: settings.showMature,
    blurMature: settings.blurMature,
    allowFollows: settings.allowFollows,
    showInSearch: settings.showInSearch,
    showRecommendations: settings.showRecommendations,
    autoplayMedia: settings.autoplayMedia,
    reduceMotion: settings.reduceMotion,
    openPostsNewTab: settings.openPostsNewTab,
    safeSearch: settings.safeSearch,
    showFollowerCount: settings.showFollowerCount,
  }
}

const app = new Hono()
  .use(authMiddleware)
  .get(
    "/me/settings",
    describeRoute({
      description: "Current user's settings, or defaults when none are stored",
      responses: {
        200: {
          description: "User settings",
          content: {
            "application/json": {
              schema: resolver(userSettingsSchemaResponse),
            },
          },
        },
      },
    }),
    async (c) => {
      const user = c.var.user

      const settings = await fetchUserSettings(db).getOne(user.id, USER_SETTINGS_FIELDS)

      return c.json(settings ? toResponse(settings) : USER_SETTINGS_DEFAULTS)
    },
  )
  .patch(
    "/me/settings",
    describeRoute({
      description: "Update a subset of the current user's settings",
      responses: {
        200: {
          description: "Updated user settings",
          content: {
            "application/json": {
              schema: resolver(userSettingsSchemaResponse),
            },
          },
        },
        400: {
          description: "Invalid request",
          content: {
            "application/json": {
              schema: resolver(ErrorSchemaResponse),
            },
          },
        },
      },
    }),
    validator("json", userSettingsUpdateSchemaRequest),
    async (c) => {
      const user = c.var.user
      const body = c.req.valid("json")

      if (Object.keys(body).length === 0) {
        const settings = await fetchUserSettings(db).getOne(user.id, USER_SETTINGS_FIELDS)
        return c.json(settings ? toResponse(settings) : USER_SETTINGS_DEFAULTS)
      }

      const settings = await crudUserSettings(db).upsert(user.id, body)
      if (body.showInSearch !== undefined) {
        await enqueueEsSyncUser(user.id)
      }

      return c.json(toResponse(settings))
    },
  )

export default app
