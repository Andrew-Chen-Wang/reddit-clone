import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

const draftType = Type.Union([Type.Literal("text"), Type.Literal("link"), Type.Literal("media")])

export const draftCreateSchemaRequest = Type.Object({
  communityId: Type.Optional(Nullable(UUID7String)),
  isProfile: Type.Optional(Type.Boolean()),
  type: Type.Optional(draftType),
  title: Type.Optional(Nullable(Type.String({ maxLength: 300 }))),
  bodyMd: Type.Optional(Nullable(Type.String({ maxLength: 40000 }))),
  linkUrl: Type.Optional(Nullable(Type.String({ maxLength: 2000 }))),
  isNsfw: Type.Optional(Type.Boolean()),
  isSpoiler: Type.Optional(Type.Boolean()),
  isOc: Type.Optional(Type.Boolean()),
  flairTemplateId: Type.Optional(Nullable(UUID7String)),
})

export const draftUpdateSchemaRequest = Type.Object({
  communityId: Type.Optional(Nullable(UUID7String)),
  isProfile: Type.Optional(Type.Boolean()),
  type: Type.Optional(draftType),
  title: Type.Optional(Nullable(Type.String({ maxLength: 300 }))),
  bodyMd: Type.Optional(Nullable(Type.String({ maxLength: 40000 }))),
  linkUrl: Type.Optional(Nullable(Type.String({ maxLength: 2000 }))),
  isNsfw: Type.Optional(Type.Boolean()),
  isSpoiler: Type.Optional(Type.Boolean()),
  isOc: Type.Optional(Type.Boolean()),
  flairTemplateId: Type.Optional(Nullable(UUID7String)),
})

export const draftIdSchemaParam = Type.Object({
  id: UUID7String,
})

export const draftCreateSchemaResponse = Type.Object({
  id: UUID7String,
})

const draftSchema = Type.Object({
  id: UUID7String,
  communityId: Nullable(UUID7String),
  isProfile: Type.Boolean(),
  type: Type.String(),
  title: Nullable(Type.String()),
  bodyMd: Nullable(Type.String()),
  linkUrl: Nullable(Type.String()),
  isNsfw: Type.Boolean(),
  isSpoiler: Type.Boolean(),
  isOc: Type.Boolean(),
  flairTemplateId: Nullable(UUID7String),
  createdAt: Type.String({ format: "date-time" }),
  updatedAt: Type.String({ format: "date-time" }),
})

export const draftSchemaResponse = draftSchema

export const draftListSchemaResponse = Type.Object({
  data: Type.Array(draftSchema),
  count: Type.Number(),
  max: Type.Number(),
})
