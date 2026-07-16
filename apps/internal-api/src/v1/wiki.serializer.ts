import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

export const wikiCommunitySchemaParam = Type.Object({
  communityName: Type.String(),
})

export const wikiPageSchemaParam = Type.Object({
  communityName: Type.String(),
  slug: Type.String(),
})

export const wikiCreateSchemaRequest = Type.Object({
  slug: Type.String({ minLength: 1, maxLength: 80 }),
  title: Type.String({ minLength: 1, maxLength: 100 }),
  body: Type.String({ maxLength: 100000 }),
})

export const wikiUpdateSchemaRequest = Type.Object({
  body: Type.String({ maxLength: 100000 }),
  note: Type.Optional(Nullable(Type.String({ maxLength: 200 }))),
})

export const wikiRevertSchemaRequest = Type.Object({
  revisionId: UUID7String,
})

export const wikiCreateSchemaResponse = Type.Object({
  id: UUID7String,
  slug: Type.String(),
})

export const wikiIndexSchemaResponse = Type.Object({
  canEdit: Type.Boolean(),
  data: Type.Array(
    Type.Object({
      id: UUID7String,
      slug: Type.String(),
      title: Type.String(),
    }),
  ),
})

export const wikiPageSchemaResponse = Type.Object({
  id: UUID7String,
  slug: Type.String(),
  title: Type.String(),
  bodyMd: Nullable(Type.String()),
  currentRevisionId: Nullable(Type.String()),
  canEdit: Type.Boolean(),
  updatedAt: Nullable(Type.String({ format: "date-time" })),
  author: Nullable(
    Type.Object({
      username: Type.String(),
    }),
  ),
})

export const wikiRevisionsSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      id: UUID7String,
      note: Nullable(Type.String()),
      createdAt: Type.String({ format: "date-time" }),
      author: Nullable(
        Type.Object({
          username: Type.String(),
        }),
      ),
    }),
  ),
})
