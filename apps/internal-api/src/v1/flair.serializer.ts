import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

export const flairCommunityIdSchemaParam = Type.Object({
  communityId: UUID7String,
})

export const flairIdSchemaParam = Type.Object({
  id: UUID7String,
})

export const postFlairCreateSchemaRequest = Type.Object({
  text: Type.String({ minLength: 1, maxLength: 64 }),
  bgColor: Type.Optional(Nullable(Type.String({ maxLength: 32 }))),
  textColor: Type.Optional(Nullable(Type.String({ maxLength: 32 }))),
  modOnly: Type.Optional(Type.Boolean()),
})

export const postFlairUpdateSchemaRequest = Type.Object({
  text: Type.Optional(Type.String({ minLength: 1, maxLength: 64 })),
  bgColor: Type.Optional(Nullable(Type.String({ maxLength: 32 }))),
  textColor: Type.Optional(Nullable(Type.String({ maxLength: 32 }))),
  modOnly: Type.Optional(Type.Boolean()),
})

export const userFlairCreateSchemaRequest = Type.Object({
  text: Type.String({ minLength: 1, maxLength: 64 }),
  bgColor: Type.Optional(Nullable(Type.String({ maxLength: 32 }))),
  textColor: Type.Optional(Nullable(Type.String({ maxLength: 32 }))),
  modOnly: Type.Optional(Type.Boolean()),
  selfAssignable: Type.Optional(Type.Boolean()),
})

export const userFlairUpdateSchemaRequest = Type.Object({
  text: Type.Optional(Type.String({ minLength: 1, maxLength: 64 })),
  bgColor: Type.Optional(Nullable(Type.String({ maxLength: 32 }))),
  textColor: Type.Optional(Nullable(Type.String({ maxLength: 32 }))),
  modOnly: Type.Optional(Type.Boolean()),
  selfAssignable: Type.Optional(Type.Boolean()),
})

export const myFlairSchemaRequest = Type.Object({
  userFlairTemplateId: Type.Optional(Nullable(UUID7String)),
  customText: Type.Optional(Nullable(Type.String({ maxLength: 64 }))),
})

export const postFlairListSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      id: UUID7String,
      text: Type.String(),
      bgColor: Nullable(Type.String()),
      textColor: Nullable(Type.String()),
      modOnly: Type.Boolean(),
      position: Type.Number(),
    }),
  ),
})

export const userFlairListSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      id: UUID7String,
      text: Type.String(),
      bgColor: Nullable(Type.String()),
      textColor: Nullable(Type.String()),
      modOnly: Type.Boolean(),
      selfAssignable: Type.Boolean(),
      position: Type.Number(),
    }),
  ),
})

export const flairCreateSchemaResponse = Type.Object({
  id: UUID7String,
})
