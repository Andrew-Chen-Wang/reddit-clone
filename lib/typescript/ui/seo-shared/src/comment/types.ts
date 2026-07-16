export type CommentSortValue = "best" | "top" | "new" | "old" | "controversial"

export type CommentAuthor = {
  id: string
  username: string
  displayName: string | null
  avatarImageKey: string | null
  /**
   * Marks a site admin so the comment header renders an ADMIN badge. Optional
   * until the comment serializer carries it.
   * TODO(m17-backend): add `author.isAdmin` to the comment serializer.
   */
  isAdmin?: boolean
}

/**
 * A single comment as returned by GET /v1/comment/post/:postId. `createdAt` /
 * `editedAt` are `string | Date` so the same type covers both the SSR DAO
 * result (ISO strings) and the SPA generated client (transformed to `Date`).
 */
export type CommentNode = {
  id: string
  postId: string
  parentCommentId: string | null
  depth: number
  path: string[]
  bodyMd: string | null
  ups: number
  downs: number
  score: number
  childCount: number
  fetchedChildCount: number
  isSticky: boolean
  isDeleted: boolean
  createdAt: string | Date
  editedAt: string | Date | null
  userVote: number
  isAuthor: boolean
  /**
   * Total views for this comment's post-author insights row. The backend sends
   * it to the author only, so the "N views / See More Insights" row renders just
   * when it is present.
   * TODO(m17-backend): send author-only `viewCount` on the comment serializer.
   */
  viewCount?: number
  author: CommentAuthor | null
}

export type CommentTreeNode = CommentNode & { children: CommentTreeNode[] }

/**
 * Assemble the flat DFS-preorder rows (siblings already pre-sorted by the API)
 * into a tree. Children are attached in first-encounter order, which preserves
 * the server's sort. Duplicate ids (e.g. the focus node echoed by a parentId
 * page) collapse to a single node.
 */
export function assembleCommentTree(nodes: CommentNode[]): CommentTreeNode[] {
  const map = new Map<string, CommentTreeNode>()
  for (const node of nodes) {
    if (!map.has(node.id)) map.set(node.id, { ...node, children: [] })
  }
  const roots: CommentTreeNode[] = []
  for (const node of map.values()) {
    const parent = node.parentCommentId ? map.get(node.parentCommentId) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  return roots
}

/** Direct replies that exist on the server but are not yet loaded into the tree. */
export function unloadedReplyCount(node: CommentTreeNode): number {
  return Math.max(0, node.childCount - node.children.length)
}

/**
 * Build the tree for a single-comment permalink ("single comment thread") view.
 * The strict ancestors are stitched in front of the focused subtree so the whole
 * chain renders as one normal nested thread leading down to the target comment
 * (matching Reddit), instead of a separate "context" box. Each ancestor's
 * `childCount` is clamped to the children actually stitched in, so the sibling
 * branches we deliberately omit don't surface a spurious "N more replies" link.
 */
export function assembleFocusedThread(
  ancestors: CommentNode[],
  nodes: CommentNode[],
): CommentTreeNode[] {
  const roots = assembleCommentTree([...ancestors, ...nodes])
  const ancestorIds = new Set(ancestors.map((a) => a.id))
  const clamp = (node: CommentTreeNode): void => {
    if (ancestorIds.has(node.id)) node.childCount = node.children.length
    for (const child of node.children) clamp(child)
  }
  for (const root of roots) clamp(root)
  return roots
}
