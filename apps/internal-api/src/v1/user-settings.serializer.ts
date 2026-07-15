import { Type } from "typebox"

const displayModeSchema = Type.Union([
  Type.Literal("auto"),
  Type.Literal("light"),
  Type.Literal("dark"),
])

const feedViewSchema = Type.Union([Type.Literal("card"), Type.Literal("compact")])

const chatRequestPolicySchema = Type.Union([
  Type.Literal("everyone"),
  Type.Literal("accounts_30d"),
  Type.Literal("nobody"),
])

export const userSettingsSchemaResponse = Type.Object({
  displayMode: Type.String(),
  feedView: Type.String(),
  chatRequestPolicy: Type.String(),
  defaultMarkdownEditor: Type.Boolean(),
  showMature: Type.Boolean(),
  blurMature: Type.Boolean(),
  allowFollows: Type.Boolean(),
  showInSearch: Type.Boolean(),
  showRecommendations: Type.Boolean(),
  autoplayMedia: Type.Boolean(),
  reduceMotion: Type.Boolean(),
  openPostsNewTab: Type.Boolean(),
  safeSearch: Type.Boolean(),
  showFollowerCount: Type.Boolean(),
})

export const userSettingsUpdateSchemaRequest = Type.Object({
  displayMode: Type.Optional(displayModeSchema),
  feedView: Type.Optional(feedViewSchema),
  chatRequestPolicy: Type.Optional(chatRequestPolicySchema),
  defaultMarkdownEditor: Type.Optional(Type.Boolean()),
  showMature: Type.Optional(Type.Boolean()),
  blurMature: Type.Optional(Type.Boolean()),
  allowFollows: Type.Optional(Type.Boolean()),
  showInSearch: Type.Optional(Type.Boolean()),
  showRecommendations: Type.Optional(Type.Boolean()),
  autoplayMedia: Type.Optional(Type.Boolean()),
  reduceMotion: Type.Optional(Type.Boolean()),
  openPostsNewTab: Type.Optional(Type.Boolean()),
  safeSearch: Type.Optional(Type.Boolean()),
  showFollowerCount: Type.Optional(Type.Boolean()),
})
