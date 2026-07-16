export type CommentSortValue = "best" | "top" | "new" | "old" | "controversial"

export type CommentAuthor = {
  id: string
  username: string
  displayName: string | null
  avatarImageKey: string | null
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
