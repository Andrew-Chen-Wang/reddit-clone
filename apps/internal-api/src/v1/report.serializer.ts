import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

export const reportPostSchemaParam = Type.Object({
  postId: UUID7String,
})

export const reportCommentSchemaParam = Type.Object({
  commentId: UUID7String,
})

export const reportSchemaRequest = Type.Object({
  communityRuleId: Type.Optional(Nullable(UUID7String)),
  reasonText: Type.Optional(Nullable(Type.String({ maxLength: 500 }))),
})

export const reportSchemaResponse = Type.Object({
  reported: Type.Boolean(),
})
