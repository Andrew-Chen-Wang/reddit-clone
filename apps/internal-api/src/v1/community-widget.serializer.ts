import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

export const widgetCommunityNameSchemaParam = Type.Object({
  communityName: Type.String(),
})

export const widgetCommunityIdSchemaParam = Type.Object({
  communityId: UUID7String,
})

export const widgetIdSchemaParam = Type.Object({
  id: UUID7String,
})

export const bookmarkCreateSchemaRequest = Type.Object({
  label: Type.String({ minLength: 1, maxLength: 60 }),
  url: Type.String({ minLength: 1, maxLength: 2000 }),
})

export const bookmarkUpdateSchemaRequest = Type.Object({
  label: Type.Optional(Type.String({ minLength: 1, maxLength: 60 })),
  url: Type.Optional(Type.String({ minLength: 1, maxLength: 2000 })),
})

export const widgetTextCreateSchemaRequest = Type.Object({
  title: Type.String({ minLength: 1, maxLength: 100 }),
  body: Type.String({ maxLength: 20000 }),
})

export const widgetTextUpdateSchemaRequest = Type.Object({
  title: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  body: Type.Optional(Type.String({ maxLength: 20000 })),
})

export const widgetReorderSchemaRequest = Type.Object({
  orderedIds: Type.Array(UUID7String),
})

export const relatedSetSchemaRequest = Type.Object({
  communityIds: Type.Array(UUID7String),
})

export const widgetCreateSchemaResponse = Type.Object({
  id: UUID7String,
})

export const communityWidgetsSchemaResponse = Type.Object({
  bookmarks: Type.Array(
    Type.Object({
      id: UUID7String,
      label: Type.String(),
      url: Type.String(),
      position: Type.Number(),
    }),
  ),
  widgets: Type.Array(
    Type.Object({
      id: UUID7String,
      title: Type.String(),
      bodyMd: Type.String(),
      position: Type.Number(),
    }),
  ),
  related: Type.Array(
    Type.Object({
      id: UUID7String,
      name: Type.String(),
      displayName: Nullable(Type.String()),
      iconImageKey: Nullable(Type.String()),
      memberCount: Type.Number(),
    }),
  ),
})
