import { Type } from "typebox"
import { Nullable, UUID7String } from "../utils/common.serializer"

const permFields = {
  permEverything: Type.Optional(Type.Boolean()),
  permUsers: Type.Optional(Type.Boolean()),
  permConfig: Type.Optional(Type.Boolean()),
  permFlair: Type.Optional(Type.Boolean()),
  permMail: Type.Optional(Type.Boolean()),
  permPostsComments: Type.Optional(Type.Boolean()),
  permWiki: Type.Optional(Type.Boolean()),
}

export const modTeamCommunityParam = Type.Object({
  communityId: UUID7String,
})

export const modTeamModParam = Type.Object({
  communityId: UUID7String,
  userId: UUID7String,
})

export const modTeamInviteIdParam = Type.Object({
  id: UUID7String,
})

export const modTeamInviteSchemaRequest = Type.Object({
  username: Type.String({ minLength: 1, maxLength: 64 }),
  ...permFields,
})

export const modTeamUpdatePermsSchemaRequest = Type.Object(permFields)

export const modTeamListSchemaResponse = Type.Object({
  moderators: Type.Array(
    Type.Object({
      userId: UUID7String,
      username: Type.String(),
      avatarImageKey: Nullable(Type.String()),
      position: Type.Number(),
      permEverything: Type.Boolean(),
      permUsers: Type.Boolean(),
      permConfig: Type.Boolean(),
      permFlair: Type.Boolean(),
      permMail: Type.Boolean(),
      permPostsComments: Type.Boolean(),
      permWiki: Type.Boolean(),
    }),
  ),
  invites: Type.Array(
    Type.Object({
      id: UUID7String,
      userId: UUID7String,
      username: Type.String(),
      avatarImageKey: Nullable(Type.String()),
      createdAt: Type.String({ format: "date-time" }),
    }),
  ),
})

export const modTeamMyInvitesSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      id: UUID7String,
      communityId: UUID7String,
      communityName: Type.String(),
      communityDisplayName: Nullable(Type.String()),
      iconImageKey: Nullable(Type.String()),
      createdAt: Type.String({ format: "date-time" }),
    }),
  ),
})

export const modTeamInviteCreatedSchemaResponse = Type.Object({
  id: UUID7String,
})
