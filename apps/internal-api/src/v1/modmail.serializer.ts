import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

export const modmailFolderSchemaQuery = Type.Object({
  folder: Type.Optional(
    Type.Union([Type.Literal("new"), Type.Literal("in_progress"), Type.Literal("archived")]),
  ),
})

export const modmailCreateSchemaRequest = Type.Object({
  communityName: Type.String({ minLength: 1, maxLength: 64 }),
  subject: Type.String({ minLength: 1, maxLength: 100 }),
  body: Type.String({ minLength: 1, maxLength: 10000 }),
})

export const modmailReplySchemaRequest = Type.Object({
  body: Type.String({ minLength: 1, maxLength: 10000 }),
  isInternalNote: Type.Optional(Type.Boolean()),
})

export const modmailIdSchemaParam = Type.Object({
  id: UUID7String,
})

export const modmailCommunityIdSchemaParam = Type.Object({
  communityId: UUID7String,
})

export const modmailConversationSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      id: UUID7String,
      subject: Type.String(),
      folder: Type.String(),
      isHighlighted: Type.Boolean(),
      communityId: UUID7String,
      communityName: Type.String(),
      communityIconImageKey: Nullable(Type.String()),
      participantUserId: UUID7String,
      participantUsername: Nullable(Type.String()),
      participantAvatarImageKey: Nullable(Type.String()),
      lastMessageAt: Type.String({ format: "date-time" }),
      createdAt: Type.String({ format: "date-time" }),
    }),
  ),
})

export const modmailMessagesSchemaResponse = Type.Object({
  isMod: Type.Boolean(),
  subject: Type.String(),
  folder: Type.String(),
  isHighlighted: Type.Boolean(),
  data: Type.Array(
    Type.Object({
      id: UUID7String,
      conversationId: UUID7String,
      authorUserId: Nullable(UUID7String),
      bodyMd: Type.String(),
      isInternalNote: Type.Boolean(),
      createdAt: Type.String({ format: "date-time" }),
      authorUsername: Nullable(Type.String()),
      authorAvatarImageKey: Nullable(Type.String()),
    }),
  ),
})

export const modmailCreatedSchemaResponse = Type.Object({
  conversationId: UUID7String,
})
