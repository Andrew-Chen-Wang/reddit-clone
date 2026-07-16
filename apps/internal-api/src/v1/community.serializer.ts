import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

const visibility = Type.Union([
  Type.Literal("public"),
  Type.Literal("restricted"),
  Type.Literal("private"),
])

const commentSort = Type.Union([
  Type.Literal("best"),
  Type.Literal("top"),
  Type.Literal("new"),
  Type.Literal("controversial"),
  Type.Literal("old"),
])

const notificationLevel = Type.Union([
  Type.Literal("off"),
  Type.Literal("low"),
  Type.Literal("frequent"),
])

export const communityCreateSchemaRequest = Type.Object({
  name: Type.String({ minLength: 3, maxLength: 21, pattern: "^[A-Za-z0-9_]+$" }),
  displayName: Type.Optional(Nullable(Type.String({ maxLength: 100 }))),
  description: Type.String({ minLength: 1, maxLength: 500 }),
  visibility: Type.Optional(visibility),
  isNsfw: Type.Optional(Type.Boolean()),
  topicId: Type.Optional(Nullable(UUID7String)),
})

const allowedPostTypes = Type.Union([
  Type.Literal("all"),
  Type.Literal("text_only"),
  Type.Literal("links_only"),
])

const bodyPolicy = Type.Union([
  Type.Literal("optional"),
  Type.Literal("required"),
  Type.Literal("none"),
])

export const communityUpdateSchemaRequest = Type.Object({
  displayName: Type.Optional(Nullable(Type.String({ maxLength: 100 }))),
  description: Type.Optional(Type.String({ minLength: 1, maxLength: 500 })),
  defaultCommentSort: Type.Optional(commentSort),
  topicId: Type.Optional(Nullable(UUID7String)),
  isNsfw: Type.Optional(Type.Boolean()),
  welcomeMessage: Type.Optional(Nullable(Type.String({ maxLength: 5000 }))),
  postGuidelines: Type.Optional(Nullable(Type.String({ maxLength: 10000 }))),
  allowedPostTypes: Type.Optional(allowedPostTypes),
  bodyPolicy: Type.Optional(bodyPolicy),
  titleRegex: Type.Optional(Nullable(Type.String({ maxLength: 500 }))),
  linkDomainWhitelist: Type.Optional(Nullable(Type.Array(Type.String({ maxLength: 253 })))),
  linkDomainBlacklist: Type.Optional(Nullable(Type.Array(Type.String({ maxLength: 253 })))),
  mediaInComments: Type.Optional(Type.Boolean()),
  requirePostFlair: Type.Optional(Type.Boolean()),
  holdForReview: Type.Optional(Type.Boolean()),
  spoilerEnabled: Type.Optional(Type.Boolean()),
  archiveOldPosts: Type.Optional(Type.Boolean()),
  appearInFeeds: Type.Optional(Type.Boolean()),
  appearInRecommendations: Type.Optional(Type.Boolean()),
  notifyActivity: Type.Optional(Type.Boolean()),
  notifyReports: Type.Optional(Type.Boolean()),
  notifyMilestones: Type.Optional(Type.Boolean()),
})

export const communitySettingsSchemaResponse = Type.Object({
  id: UUID7String,
  name: Type.String(),
  displayName: Nullable(Type.String()),
  description: Type.String(),
  defaultCommentSort: Type.String(),
  topicId: Nullable(UUID7String),
  isNsfw: Type.Boolean(),
  welcomeMessage: Nullable(Type.String()),
  postGuidelines: Nullable(Type.String()),
  allowedPostTypes: Type.String(),
  bodyPolicy: Type.String(),
  titleRegex: Nullable(Type.String()),
  linkDomainWhitelist: Nullable(Type.Array(Type.String())),
  linkDomainBlacklist: Nullable(Type.Array(Type.String())),
  mediaInComments: Type.Boolean(),
  requirePostFlair: Type.Boolean(),
  holdForReview: Type.Boolean(),
  spoilerEnabled: Type.Boolean(),
  archiveOldPosts: Type.Boolean(),
  appearInFeeds: Type.Boolean(),
  appearInRecommendations: Type.Boolean(),
  notifyActivity: Type.Boolean(),
  notifyReports: Type.Boolean(),
  notifyMilestones: Type.Boolean(),
})

export const communityNameSchemaParam = Type.Object({
  name: Type.String(),
})

export const communityNameAvailableSchemaQuery = Type.Object({
  name: Type.String({ minLength: 3, maxLength: 21, pattern: "^[A-Za-z0-9_]+$" }),
})

export const communityNameAvailableSchemaResponse = Type.Object({
  available: Type.Boolean(),
})

export const communityCreateSchemaResponse = Type.Object({
  id: UUID7String,
  name: Type.String(),
})

export const communityDetailSchemaResponse = Type.Object({
  id: UUID7String,
  name: Type.String(),
  displayName: Nullable(Type.String()),
  description: Type.String(),
  visibility: Type.String(),
  isNsfw: Type.Boolean(),
  topicId: Nullable(UUID7String),
  iconImageKey: Nullable(Type.String()),
  bannerImageKey: Nullable(Type.String()),
  memberCount: Type.Number(),
  defaultCommentSort: Type.String(),
  welcomeMessage: Nullable(Type.String()),
  createdAt: Type.String({ format: "date-time" }),
  rules: Type.Array(
    Type.Object({
      id: UUID7String,
      name: Type.String(),
      description: Nullable(Type.String()),
      position: Type.Number(),
    }),
  ),
  moderators: Type.Array(
    Type.Object({
      userId: UUID7String,
      username: Type.String(),
      avatarImageKey: Nullable(Type.String()),
      position: Type.Number(),
    }),
  ),
  viewer: Type.Object({
    isMember: Type.Boolean(),
    isFavorite: Type.Boolean(),
    isModerator: Type.Boolean(),
    notificationLevel: Nullable(notificationLevel),
    pendingJoinRequest: Type.Boolean(),
    userFlair: Nullable(
      Type.Object({
        templateId: Nullable(UUID7String),
        text: Type.String(),
        bgColor: Nullable(Type.String()),
        textColor: Nullable(Type.String()),
      }),
    ),
  }),
})
