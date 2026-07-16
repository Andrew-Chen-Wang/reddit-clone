import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

export const chatListSchemaQuery = Type.Object({
  filter: Type.Optional(
    Type.Union([
      Type.Literal("all"),
      Type.Literal("groups"),
      Type.Literal("dms"),
      Type.Literal("requests"),
      Type.Literal("unread"),
    ]),
  ),
})

export const chatMessagesSchemaQuery = Type.Object({
  after: Type.Optional(UUID7String),
  cursor: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Number({ minimum: 1, multipleOf: 1 })),
})

export const chatDmSchemaRequest = Type.Object({
  username: Type.String({ minLength: 1, maxLength: 64 }),
  body: Type.String({ minLength: 1, maxLength: 4000 }),
})

export const chatGroupSchemaRequest = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
  usernames: Type.Array(Type.String({ minLength: 1, maxLength: 64 }), {
    minItems: 1,
    maxItems: 19,
  }),
  body: Type.String({ minLength: 1, maxLength: 4000 }),
})

export const chatMessageSchemaRequest = Type.Object({
  body: Type.String({ minLength: 1, maxLength: 4000 }),
})

export const chatRenameSchemaRequest = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
})

export const chatConversationIdSchemaParam = Type.Object({
  conversationId: UUID7String,
})

export const chatParticipantSchemaParam = Type.Object({
  conversationId: UUID7String,
  userId: UUID7String,
})

export const chatMessageIdSchemaParam = Type.Object({
  messageId: UUID7String,
})

const chatParticipantSchema = Type.Object({
  userId: UUID7String,
  username: Type.String(),
  displayName: Nullable(Type.String()),
  avatarImageKey: Nullable(Type.String()),
  role: Type.String(),
  status: Type.String(),
})

const chatLastMessageSchema = Type.Object({
  id: UUID7String,
  body: Nullable(Type.String()),
  senderUserId: Nullable(UUID7String),
  isDeleted: Type.Boolean(),
  createdAt: Type.String({ format: "date-time" }),
})

export const chatConversationSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      id: UUID7String,
      isGroup: Type.Boolean(),
      name: Nullable(Type.String()),
      createdByUserId: Nullable(UUID7String),
      lastMessageAt: Type.String({ format: "date-time" }),
      createdAt: Type.String({ format: "date-time" }),
      myStatus: Type.String(),
      myRole: Type.String(),
      unreadCount: Type.Number(),
      lastMessage: Nullable(chatLastMessageSchema),
      participants: Type.Array(chatParticipantSchema),
    }),
  ),
})

const chatMessageSchema = Type.Object({
  id: UUID7String,
  conversationId: UUID7String,
  senderUserId: Nullable(UUID7String),
  body: Nullable(Type.String()),
  isDeleted: Type.Boolean(),
  createdAt: Type.String({ format: "date-time" }),
})

export const chatMessagesSchemaResponse = Type.Object({
  data: Type.Array(chatMessageSchema),
  nextCursor: Nullable(Type.String()),
})

export const chatMessageSchemaResponse = chatMessageSchema

export const chatConversationCreatedSchemaResponse = Type.Object({
  conversationId: UUID7String,
})

export const chatUnreadCountSchemaResponse = Type.Object({
  count: Type.Number(),
})
