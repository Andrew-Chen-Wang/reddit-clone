import type { GetApiV1ModmailMineAsModResponse } from "@lib/api-client/generated/types.gen"

export type ModmailConversation = NonNullable<GetApiV1ModmailMineAsModResponse>["data"][number]

export type ModmailFolder = "new" | "in_progress" | "archived"
