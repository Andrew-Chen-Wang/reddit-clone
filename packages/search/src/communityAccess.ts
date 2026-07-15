import type { QueryDslQueryContainer } from "@elastic/elasticsearch/lib/api/types"

export type CommunityVisibility = "public" | "restricted" | "private"

// Public and restricted communities (and their content) are readable by anyone; private
// ones only surface to viewers granted access. `viewableCommunityIds` is the allowlist of
// private (or otherwise membership-gated) community ids the viewer may read — empty for
// anonymous viewers.
export interface CommunityViewerAccess {
  viewableCommunityIds: string[]
}

const PUBLICLY_VISIBLE: CommunityVisibility[] = ["public", "restricted"]

/**
 * Builds an ES filter clause matching content in publicly visible communities plus any
 * community on the viewer's allowlist. `visibilityField` holds the denormalized
 * visibility on the document (`community_visibility` for posts/comments, `visibility` for
 * the community index itself); `communityIdField` holds the community id (`community_id`
 * for posts/comments, `_id` for the community index itself).
 */
export function communityAccessFilter(
  access: CommunityViewerAccess,
  {
    visibilityField = "community_visibility",
    communityIdField = "community_id",
  }: { visibilityField?: string; communityIdField?: string } = {},
): QueryDslQueryContainer {
  const should: QueryDslQueryContainer[] = [{ terms: { [visibilityField]: PUBLICLY_VISIBLE } }]

  if (access.viewableCommunityIds.length > 0) {
    should.push({ terms: { [communityIdField]: access.viewableCommunityIds } })
  }

  return { bool: { should, minimum_should_match: 1 } }
}
