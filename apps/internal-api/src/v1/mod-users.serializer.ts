import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

export const modUsersCommunityParam = Type.Object({
  communityId: UUID7String,
})

export const modUsersUsernameParam = Type.Object({
  communityId: UUID7String,
  username: Type.String({ minLength: 1, maxLength: 64 }),
})

export const modUsersNoteIdParam = Type.Object({
  id: UUID7String,
})

export const banSchemaRequest = Type.Object({
  username: Type.String({ minLength: 1, maxLength: 64 }),
  communityRuleId: Type.Optional(Nullable(UUID7String)),
  modNote: Type.Optional(Nullable(Type.String({ maxLength: 500 }))),
  messageToUser: Type.Optional(Nullable(Type.String({ maxLength: 1000 }))),
  days: Type.Optional(Nullable(Type.Number({ minimum: 1, maximum: 3650, multipleOf: 1 }))),
})

export const muteSchemaRequest = Type.Object({
  username: Type.String({ minLength: 1, maxLength: 64 }),
  days: Type.Optional(Nullable(Type.Union([Type.Literal(3), Type.Literal(7), Type.Literal(28)]))),
})

export const approveSchemaRequest = Type.Object({
  username: Type.String({ minLength: 1, maxLength: 64 }),
})

export const noteCreateSchemaRequest = Type.Object({
  label: Type.Optional(Nullable(Type.String({ maxLength: 100 }))),
  note: Type.String({ minLength: 1, maxLength: 1000 }),
})

export const noteCreatedSchemaResponse = Type.Object({
  id: UUID7String,
})

const banRow = Type.Object({
  userId: UUID7String,
  username: Type.String(),
  avatarImageKey: Nullable(Type.String()),
  communityRuleId: Nullable(UUID7String),
  modNote: Nullable(Type.String()),
  messageToUser: Nullable(Type.String()),
  expiresAt: Nullable(Type.String({ format: "date-time" })),
  createdAt: Type.String({ format: "date-time" }),
})

const mutedRow = Type.Object({
  userId: UUID7String,
  username: Type.String(),
  avatarImageKey: Nullable(Type.String()),
  expiresAt: Nullable(Type.String({ format: "date-time" })),
  createdAt: Type.String({ format: "date-time" }),
})

const approvedRow = Type.Object({
  userId: UUID7String,
  username: Type.String(),
  avatarImageKey: Nullable(Type.String()),
  createdAt: Type.String({ format: "date-time" }),
})

export const bannedListSchemaResponse = Type.Object({
  data: Type.Array(banRow),
})

export const mutedListSchemaResponse = Type.Object({
  data: Type.Array(mutedRow),
})

export const approvedListSchemaResponse = Type.Object({
  data: Type.Array(approvedRow),
})

export const restrictedListSchemaResponse = Type.Object({
  banned: Type.Array(banRow),
  muted: Type.Array(mutedRow),
})

export const notesListSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      id: UUID7String,
      label: Nullable(Type.String()),
      note: Type.String(),
      createdByUserId: Nullable(UUID7String),
      createdByUsername: Nullable(Type.String()),
      createdAt: Type.String({ format: "date-time" }),
    }),
  ),
})
