import { Type } from "typebox"
import { UUID7String } from "../utils/common.serializer"

export const commentActionSchemaParam = Type.Object({
  commentId: UUID7String,
})

export const commentSaveStateSchemaResponse = Type.Object({
  saved: Type.Boolean(),
})

export const commentFollowStateSchemaResponse = Type.Object({
  following: Type.Boolean(),
})
