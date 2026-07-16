import { Type } from "typebox"
import { UUID7String } from "../utils/common.serializer"

export const postActionSchemaParam = Type.Object({
  postId: UUID7String,
})

export const saveStateSchemaResponse = Type.Object({
  saved: Type.Boolean(),
})

export const hideStateSchemaResponse = Type.Object({
  hidden: Type.Boolean(),
})

export const followStateSchemaResponse = Type.Object({
  following: Type.Boolean(),
})

export const shareSchemaResponse = Type.Object({
  shareCount: Type.Number(),
})
