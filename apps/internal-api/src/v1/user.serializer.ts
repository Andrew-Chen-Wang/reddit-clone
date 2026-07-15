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
