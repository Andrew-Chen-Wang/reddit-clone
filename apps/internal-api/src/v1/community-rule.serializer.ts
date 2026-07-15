import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

export const ruleCommunityIdSchemaParam = Type.Object({
  communityId: UUID7String,
})

export const ruleIdSchemaParam = Type.Object({
  id: UUID7String,
})

export const ruleCreateSchemaRequest = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
  description: Type.Optional(Nullable(Type.String({ maxLength: 500 }))),
})

export const ruleUpdateSchemaRequest = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  description: Type.Optional(Nullable(Type.String({ maxLength: 500 }))),
})

export const ruleReorderSchemaRequest = Type.Object({
  orderedIds: Type.Array(UUID7String),
})

export const ruleListSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      id: UUID7String,
      name: Type.String(),
      description: Nullable(Type.String()),
      position: Type.Number(),
    }),
  ),
})

export const ruleCreateSchemaResponse = Type.Object({
  id: UUID7String,
})
