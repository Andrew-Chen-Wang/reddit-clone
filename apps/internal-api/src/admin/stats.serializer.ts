import { Type } from "typebox"

export const adminStatsSchemaResponse = Type.Object({
  users: Type.Number(),
  posts: Type.Number(),
  communities: Type.Number(),
  comments: Type.Number(),
  reportsPending: Type.Number(),
})
