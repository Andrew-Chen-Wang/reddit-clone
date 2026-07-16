import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

export const userMeSchemaResponse = Type.Object({
  id: UUID7String,
  username: Type.String(),
  displayName: Nullable(Type.String()),
  about: Nullable(Type.String()),
  avatarImageKey: Nullable(Type.String()),
  bannerImageKey: Nullable(Type.String()),
  postKarma: Type.Number(),
  commentKarma: Type.Number(),
  createdAt: Type.String({ format: "date-time" }),
  email: Type.String(),
  isAdmin: Type.Boolean(),
})

export const userPublicSchemaResponse = Type.Object({
  id: UUID7String,
  username: Type.String(),
  displayName: Nullable(Type.String()),
  about: Nullable(Type.String()),
  avatarImageKey: Nullable(Type.String()),
  bannerImageKey: Nullable(Type.String()),
  postKarma: Type.Number(),
  commentKarma: Type.Number(),
  createdAt: Type.String({ format: "date-time" }),
})

export const userUpdateSchemaRequest = Type.Object({
  displayName: Type.Optional(Nullable(Type.String({ maxLength: 30 }))),
  about: Type.Optional(Nullable(Type.String({ maxLength: 200 }))),
})

export const usernameAvailableSchemaQuery = Type.Object({
  username: Type.String({ minLength: 3, maxLength: 20, pattern: "^[A-Za-z0-9_-]+$" }),
})

export const usernameAvailableSchemaResponse = Type.Object({
  available: Type.Boolean(),
})

export const userByUsernameSchemaParam = Type.Object({
  username: Type.String(),
})

export const userSocialLinksSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      id: UUID7String,
      platform: Type.String(),
      url: Type.String(),
      label: Nullable(Type.String()),
      position: Type.Number(),
    }),
  ),
})

export const userSocialLinkCreateSchemaRequest = Type.Object({
  platform: Type.String({ minLength: 1, maxLength: 40 }),
  url: Type.String({ minLength: 1, maxLength: 2000 }),
  label: Type.Optional(Nullable(Type.String({ maxLength: 60 }))),
  position: Type.Optional(Type.Number({ minimum: 0, multipleOf: 1 })),
})

export const userSocialLinkCreateSchemaResponse = Type.Object({
  id: UUID7String,
})

export const userModeratingSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      id: UUID7String,
      name: Type.String(),
      iconImageKey: Nullable(Type.String()),
      memberCount: Type.Number(),
    }),
  ),
})
