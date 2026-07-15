import { Type } from "typebox"
import { UUID7String } from "../utils/common.serializer"

export const topicListSchemaResponse = Type.Object({
  data: Type.Array(
    Type.Object({
      id: UUID7String,
      name: Type.String(),
      slug: Type.String(),
      displayOrder: Type.Number(),
    }),
  ),
})
