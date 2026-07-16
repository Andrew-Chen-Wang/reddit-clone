import type {
  GetApiV1ChatByConversationIdMessagesResponse,
  GetApiV1ChatResponse,
} from "@lib/api-client/generated/types.gen"

export type Conversation = NonNullable<GetApiV1ChatResponse>["data"][number]
export type ConversationParticipant = Conversation["participants"][number]
export type ChatMessage = NonNullable<GetApiV1ChatByConversationIdMessagesResponse>["data"][number]

export type ChatFilter = "all" | "groups" | "dms" | "requests" | "unread"

/** The other participant in a DM (first participant that is not the viewer). */
export function peerOf(
  conversation: Conversation,
  currentUserId: string | undefined,
): ConversationParticipant | undefined {
  return conversation.participants.find((p) => p.userId !== currentUserId)
}

/** Display label for a conversation row / thread header. */
export function conversationTitle(
  conversation: Conversation,
  currentUserId: string | undefined,
): string {
  if (conversation.isGroup) return conversation.name ?? "Group chat"
  const peer = peerOf(conversation, currentUserId)
  if (!peer) return "Direct message"
  return peer.displayName ?? `u/${peer.username}`
}
