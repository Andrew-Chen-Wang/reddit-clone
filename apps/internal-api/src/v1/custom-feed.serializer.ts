import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

export const customFeedIdSchemaParam = Type.Object({
  id: UUID7String,
})

export const customFeedCommunitySchemaParam = Type.Object({
  id: UUID7String,
  communityId: UUID7String,
})

export const customFeedUserSlugSchemaParam = Type.Object({
  username: Type.String(),
  slug: Type.String(),
})

export const customFeedCreateSchemaRequest = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 50 }),
  description: Type.Optional(Nullable(Type.String({ maxLength: 500 }))),
})

export const customFeedUpdateSchemaRequest = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 50 })),
  description: Type.Optional(Nullable(Type.String({ maxLength: 500 }))),
  isFavorite: Type.Optional(Type.Boolean()),
})

export const customFeedPostsSchemaQuery = Type.Object({
  sort: Type.Optional(
    Type.Union([
      Type.Literal("hot"),
      Type.Literal("new"),
      Type.Literal("top"),
      Type.Literal("controversial"),
      Type.Literal("rising"),
    ]),
  ),
  t: Type.Optional(
    Type.Union([
      Type.Literal("hour"),
      Type.Literal("day"),
      Type.Literal("week"),
      Type.Literal("month"),
      Type.Literal("year"),
      Type.Literal("all"),
    ]),
  ),
  cursor: Type.Optional(Type.String()),
})

export const customFeedCreateSchemaResponse = Type.Object({
  id: UUID7String,
  slug: Type.String(),
})

const feedCommunityCard = Type.Object({
  id: UUID7String,
  name: Type.String(),
  displayName: Nullable(Type.String()),
  iconImageKey: Nullable(Type.String()),
  visibility: Type.String(),
})

export const customFeedMineSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      id: UUID7String,
      name: Type.String(),
      slug: Type.String(),
      description: Nullable(Type.String()),
      isFavorite: Type.Boolean(),
      communityCount: Type.Number(),
      communities: Type.Array(
        Type.Object({
          name: Type.String(),
          iconImageKey: Nullable(Type.String()),
        }),
      ),
    }),
  ),
})

export const customFeedDetailSchemaResponse = Type.Object({
  id: UUID7String,
  name: Type.String(),
  slug: Type.String(),
  description: Nullable(Type.String()),
  isFavorite: Type.Boolean(),
  isOwner: Type.Boolean(),
  owner: Type.Object({
    username: Type.String(),
  }),
  communities: Type.Array(feedCommunityCard),
})
