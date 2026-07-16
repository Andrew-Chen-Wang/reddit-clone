import { commentIndexDefinition } from "./commentIndex"
import { communityIndexDefinition } from "./communityIndex"
import { ensureIndexes } from "./indexBootstrap"
import { postIndexDefinition } from "./postIndex"
import { userIndexDefinition } from "./userIndex"

export { client } from "./client"
export { ensureIndex, ensureIndexes, type IndexDefinition } from "./indexBootstrap"
export {
  communityAccessFilter,
  type CommunityViewerAccess,
  type CommunityVisibility,
} from "./communityAccess"
export { markdownToText } from "./text"
export { type ContentSort, type SearchHit, type SearchResults } from "./searchUtils"
export {
  deletePost,
  indexPost,
  POST_INDEX,
  postIndexDefinition,
  type PostDocument,
  type SearchPostsParams,
  searchPosts,
} from "./postIndex"
export {
  COMMENT_INDEX,
  commentIndexDefinition,
  type CommentDocument,
  deleteComment,
  indexComment,
  type SearchCommentsParams,
  searchComments,
} from "./commentIndex"
export {
  COMMUNITY_INDEX,
  communityIndexDefinition,
  type CommunityDocument,
  deleteCommunity,
  indexCommunity,
  type MoreLikeCommunitiesParams,
  moreLikeCommunities,
  type SearchCommunitiesParams,
  searchCommunities,
  suggestCommunities,
} from "./communityIndex"
export {
  deleteUser,
  indexUser,
  type SearchUsersParams,
  searchUsers,
  suggestUsers,
  USER_INDEX,
  userIndexDefinition,
  type UserDocument,
} from "./userIndex"

let ensured: Promise<void> | null = null

export async function ensureSearchIndexes(): Promise<void> {
  ensured ??= ensureIndexes([
    postIndexDefinition,
    commentIndexDefinition,
    communityIndexDefinition,
    userIndexDefinition,
  ])
  await ensured
}
