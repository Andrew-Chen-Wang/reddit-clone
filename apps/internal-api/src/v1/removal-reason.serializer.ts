import { Type } from "typebox"
import { UUID7String } from "../utils/common.serializer"

export const removalReasonCommunityParam = Type.Object({
  communityId: UUID7String,
})

export const removalReasonIdParam = Type.Object({
  id: UUID7String,
})

export const removalReasonCreateSchemaRequest = Type.Object({
  title: Type.String({ minLength: 1, maxLength: 100 }),
  message: Type.String({ minLength: 1, maxLength: 10000 }),
})

export const removalReasonUpdateSchemaRequest = Type.Object({
  title: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  message: Type.Optional(Type.String({ minLength: 1, maxLength: 10000 })),
})

export const removalReasonReorderSchemaRequest = Type.Object({
  orderedIds: Type.Array(UUID7String),
})

export const removalReasonCreateSchemaResponse = Type.Object({
  id: UUID7String,
})

export const removalReasonListSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      id: UUID7String,
      title: Type.String(),
      message: Type.String(),
      position: Type.Number(),
    }),
  ),
})
