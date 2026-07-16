import { Type } from "typebox"
import { UUID7String } from "../utils/common.serializer"

export const savedResponseCommunityParam = Type.Object({
  communityId: UUID7String,
})

export const savedResponseIdParam = Type.Object({
  id: UUID7String,
})

export const savedResponseCreateSchemaRequest = Type.Object({
  title: Type.String({ minLength: 1, maxLength: 100 }),
  bodyMd: Type.String({ minLength: 1, maxLength: 10000 }),
})

export const savedResponseUpdateSchemaRequest = Type.Object({
  title: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  bodyMd: Type.Optional(Type.String({ minLength: 1, maxLength: 10000 })),
})

export const savedResponseCreateSchemaResponse = Type.Object({
  id: UUID7String,
})

export const savedResponseListSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      id: UUID7String,
      title: Type.String(),
      bodyMd: Type.String(),
    }),
  ),
})
