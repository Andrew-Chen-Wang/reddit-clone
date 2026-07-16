import { Type } from "typebox"
import { UUID7String } from "../utils/common.serializer"

export const postVoteSchemaParam = Type.Object({
  postId: UUID7String,
})

export const postVoteSchemaRequest = Type.Object({
  value: Type.Union([Type.Literal(1), Type.Literal(0), Type.Literal(-1)]),
})

export const postVoteSchemaResponse = Type.Object({
  ups: Type.Number(),
  downs: Type.Number(),
  score: Type.Number(),
  userVote: Type.Number(),
})
