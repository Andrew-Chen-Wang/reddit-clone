import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Lock } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@ui/base/ui/alert-dialog"
import { Button } from "@ui/base/ui/button"
import { Spinner } from "@ui/base/ui/spinner"
import {
  assembleCommentTree,
  assembleFocusedThread,
  type CommentNode,
} from "@ui/seo-shared/comment/types"
import { CommentComposer } from "@ui/seo-shared/comment/CommentComposer"
import { CommentSkeleton } from "@ui/seo-shared/comment/CommentSkeleton"
import { CommentSorter } from "@ui/seo-shared/comment/CommentSorter"
import { CommentTree, type CommentTreeCallbacks } from "@ui/seo-shared/comment/CommentTree"
import type { CommentSortValue } from "@ui/seo-shared/comment/types"
import {
  getApiV1CommentPostByPostIdOptions,
  getApiV1PostByIdOptions,
  getApiV1UserMeOptions,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import {
  deleteApiV1CommentById,
  getApiV1CommentPostByPostId,
  patchApiV1CommentById,
  postApiV1Comment,
  putApiV1CommentVoteByCommentId,
} from "@lib/api-client/generated/sdk.gen"

function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "error" in err) {
    const inner = (err as { error?: { message?: unknown } }).error
    if (inner && typeof inner.message === "string") return inner.message
  }
  return fallback
}

function applyVoteToNode(node: CommentNode, value: -1 | 0 | 1): CommentNode {
  return { ...node, userVote: value, score: node.score + (value - node.userVote) }
}

export type CommentSectionProps = {
  postId: string
  communityName: string
  sort: CommentSortValue
  focusCommentId?: string
  commentCount: number
  locked: boolean
  onSortChange: (sort: CommentSortValue) => void
  onExitPermalink: () => void
}

export function CommentSection({
  postId,
  communityName,
  sort,
  focusCommentId,
  commentCount,
  locked,
  onSortChange,
  onExitPermalink,
}: CommentSectionProps) {
  const queryClient = useQueryClient()
  const meQuery = useQuery(getApiV1UserMeOptions())
  const postQuery = useQuery(getApiV1PostByIdOptions({ path: { id: postId } }))
  const postAuthorId = postQuery.data?.author?.id

  const baseQuery = useQuery(
    getApiV1CommentPostByPostIdOptions({
      path: { postId },
      query: { sort, ...(focusCommentId ? { parentId: focusCommentId } : {}) },
    }),
  )

  const [flat, setFlat] = useState<CommentNode[]>([])
  const [ancestors, setAncestors] = useState<CommentNode[]>([])
  const [rootCursor, setRootCursor] = useState<string | null>(null)
  const [loadingReplies, setLoadingReplies] = useState<ReadonlySet<string>>(() => new Set())
  const [loadingMoreRoots, setLoadingMoreRoots] = useState(false)

  const [replyingId, setReplyingId] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState("")
  const [topDraft, setTopDraft] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [deletingNode, setDeletingNode] = useState<CommentNode | null>(null)

  // Seed local state from the base query once per (sort, focus) so background
  // refetches don't clobber locally-loaded replies / pagination.
  const [seeded, setSeeded] = useState<string | null>(null)
  const key = `${sort}|${focusCommentId ?? ""}`
  if (baseQuery.data && seeded !== key) {
    setSeeded(key)
    setFlat(baseQuery.data.data)
    setAncestors(baseQuery.data.ancestors)
    setRootCursor(baseQuery.data.nextCursor)
  }

  const tree = useMemo(
    () => (focusCommentId ? assembleFocusedThread(ancestors, flat) : assembleCommentTree(flat)),
    [flat, ancestors, focusCommentId],
  )

  function invalidatePost() {
    void queryClient.invalidateQueries({
      queryKey: getApiV1PostByIdOptions({ path: { id: postId } }).queryKey,
    })
  }

  function permalinkPath(commentId: string): string {
    return `/r/${communityName}/comments/${postId}?comment=${commentId}&sort=${sort}`
  }

  async function handleVote(node: CommentNode, value: -1 | 0 | 1) {
    const snapshot = flat
    setFlat((cur) => cur.map((n) => (n.id === node.id ? applyVoteToNode(n, value) : n)))
    try {
      const { data } = await putApiV1CommentVoteByCommentId({
        path: { commentId: node.id },
        body: { value },
        throwOnError: true,
      })
      setFlat((cur) =>
        cur.map((n) =>
          n.id === node.id
            ? { ...n, ups: data.ups, downs: data.downs, score: data.score, userVote: data.userVote }
            : n,
        ),
      )
    } catch (err: unknown) {
      setFlat(snapshot)
      toast.error(errorMessage(err, "Could not register your vote"))
    }
  }

  async function submitTopComment() {
    if (!topDraft.trim() || submitting) return
    setSubmitting(true)
    try {
      const { data } = await postApiV1Comment({
        body: { postId, bodyMd: topDraft },
        throwOnError: true,
      })
      const optimistic = buildOptimistic(data.id, null, 0, [data.id], topDraft)
      if (optimistic) setFlat((cur) => [optimistic, ...cur])
      setTopDraft("")
      invalidatePost()
      toast.success("Comment posted")
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Could not post your comment"))
    } finally {
      setSubmitting(false)
    }
  }

  function buildOptimistic(
    id: string,
    parentCommentId: string | null,
    depth: number,
    path: string[],
    bodyMd: string,
  ): CommentNode | null {
    const me = meQuery.data
    return {
      id,
      postId,
      parentCommentId,
      depth,
      path,
      bodyMd,
      ups: 1,
      downs: 0,
      score: 1,
      childCount: 0,
      fetchedChildCount: 0,
      isSticky: false,
      isDeleted: false,
      createdAt: new Date(),
      editedAt: null,
      userVote: 1,
      isAuthor: true,
      author: me
        ? {
            id: me.id,
            username: me.username,
            displayName: me.displayName,
            avatarImageKey: me.avatarImageKey,
          }
        : null,
    }
  }

  async function submitReply(parent: CommentNode) {
    if (!replyDraft.trim() || submitting) return
    setSubmitting(true)
    try {
      const { data } = await postApiV1Comment({
        body: { postId, parentCommentId: parent.id, bodyMd: replyDraft },
        throwOnError: true,
      })
      const optimistic = buildOptimistic(
        data.id,
        parent.id,
        parent.depth + 1,
        [...parent.path, data.id],
        replyDraft,
      )
      setFlat((cur) => {
        const bumped = cur.map((n) =>
          n.id === parent.id ? { ...n, childCount: n.childCount + 1 } : n,
        )
        return optimistic ? [...bumped, optimistic] : bumped
      })
      setReplyingId(null)
      setReplyDraft("")
      invalidatePost()
      toast.success("Reply posted")
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Could not post your reply"))
    } finally {
      setSubmitting(false)
    }
  }

  async function submitEdit(node: CommentNode) {
    if (!editDraft.trim() || submitting) return
    setSubmitting(true)
    try {
      await patchApiV1CommentById({
        path: { id: node.id },
        body: { bodyMd: editDraft },
        throwOnError: true,
      })
      setFlat((cur) =>
        cur.map((n) => (n.id === node.id ? { ...n, bodyMd: editDraft, editedAt: new Date() } : n)),
      )
      setEditingId(null)
      setEditDraft("")
      toast.success("Comment updated")
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Could not update your comment"))
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmDelete() {
    const node = deletingNode
    if (!node) return
    setDeletingNode(null)
    try {
      await deleteApiV1CommentById({ path: { id: node.id }, throwOnError: true })
      setFlat((cur) => {
        if (node.childCount > 0) {
          return cur.map((n) =>
            n.id === node.id ? { ...n, isDeleted: true, bodyMd: null, author: null } : n,
          )
        }
        return cur
          .filter((n) => n.id !== node.id)
          .map((n) =>
            n.id === node.parentCommentId ? { ...n, childCount: Math.max(0, n.childCount - 1) } : n,
          )
      })
      invalidatePost()
      toast.success("Comment deleted")
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Could not delete your comment"))
    }
  }

  async function loadReplies(node: CommentNode) {
    if (loadingReplies.has(node.id)) return
    setLoadingReplies((cur) => new Set(cur).add(node.id))
    try {
      const { data } = await getApiV1CommentPostByPostId({
        path: { postId },
        query: { sort, parentId: node.id },
        throwOnError: true,
      })
      setFlat((cur) => {
        const seen = new Set(cur.map((n) => n.id))
        const additions = data.data.filter((n) => !seen.has(n.id))
        return additions.length > 0 ? [...cur, ...additions] : cur
      })
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Could not load replies"))
    } finally {
      setLoadingReplies((cur) => {
        const next = new Set(cur)
        next.delete(node.id)
        return next
      })
    }
  }

  async function loadMoreRoots() {
    if (!rootCursor || loadingMoreRoots) return
    setLoadingMoreRoots(true)
    try {
      const { data } = await getApiV1CommentPostByPostId({
        path: { postId },
        query: { sort, cursor: rootCursor },
        throwOnError: true,
      })
      setFlat((cur) => {
        const seen = new Set(cur.map((n) => n.id))
        const additions = data.data.filter((n) => !seen.has(n.id))
        return additions.length > 0 ? [...cur, ...additions] : cur
      })
      setRootCursor(data.nextCursor)
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Could not load more comments"))
    } finally {
      setLoadingMoreRoots(false)
    }
  }

  const callbacks: CommentTreeCallbacks = {
    buildAuthorHref: (username) => `/user/${username}`,
    buildPermalinkHref: (commentId) => permalinkPath(commentId),
    voteDisabled: locked,
    onVote: locked
      ? undefined
      : (node, value) => {
          void handleVote(node, value)
        },
    onReply: locked
      ? undefined
      : (node) => {
          // Toggle: pressing Reply again on the open composer closes it.
          setReplyingId((prev) => (prev === node.id ? null : node.id))
          setReplyDraft("")
          setEditingId(null)
        },
    onShare: (node) => {
      void navigator.clipboard.writeText(`${window.location.origin}${permalinkPath(node.id)}`)
      toast.success("Link copied")
    },
    onEdit: (node) => {
      setEditingId(node.id)
      setEditDraft(node.bodyMd ?? "")
      setReplyingId(null)
    },
    onDelete: (node) => {
      setDeletingNode(node)
    },
    onLoadReplies: (node) => {
      void loadReplies(node)
    },
    loadingReplies,
    replyingId,
    renderReplyComposer: (node) => (
      <CommentComposer
        value={replyDraft}
        onChange={setReplyDraft}
        onSubmit={() => {
          void submitReply(node)
        }}
        onCancel={() => {
          setReplyingId(null)
        }}
        submitLabel="Reply"
        placeholder={`Reply to ${node.author?.username ?? "comment"}`}
        isPending={submitting}
        focusOnMount
      />
    ),
    editingId,
    renderEditComposer: (node) => (
      <CommentComposer
        value={editDraft}
        onChange={setEditDraft}
        onSubmit={() => {
          void submitEdit(node)
        }}
        onCancel={() => {
          setEditingId(null)
        }}
        submitLabel="Save"
        isPending={submitting}
        focusOnMount
      />
    ),
  }

  const isLoading = baseQuery.isLoading || seeded !== key

  return (
    <section className="mt-4 flex flex-col gap-4 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          {commentCount} {commentCount === 1 ? "Comment" : "Comments"}
        </h2>
        <CommentSorter sort={sort} onSortChange={onSortChange} />
      </div>

      {locked ? (
        <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
          <Lock className="size-4" />
          Comments are locked. You can't add new comments.
        </div>
      ) : (
        <CommentComposer
          value={topDraft}
          onChange={setTopDraft}
          onSubmit={() => {
            void submitTopComment()
          }}
          submitLabel="Comment"
          placeholder="Join the conversation"
          isPending={submitting}
        />
      )}

      {focusCommentId ? (
        <div className="flex flex-col gap-1 rounded-md border bg-muted/30 px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">
            You are viewing a single comment&apos;s thread.
          </span>
          <button
            type="button"
            onClick={onExitPermalink}
            className="w-fit text-xs font-semibold text-primary hover:underline"
          >
            ← View all comments
          </button>
        </div>
      ) : null}

      {isLoading ? (
        <CommentSkeleton />
      ) : tree.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No comments yet. Be the first to share what you think.
        </p>
      ) : (
        <CommentTree
          nodes={tree}
          callbacks={callbacks}
          postAuthorId={postAuthorId}
          highlightCommentId={focusCommentId}
        />
      )}

      {!focusCommentId && rootCursor ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loadingMoreRoots}
            onClick={() => {
              void loadMoreRoots()
            }}
          >
            {loadingMoreRoots ? <Spinner className="size-4" /> : null}
            View more comments
          </Button>
        </div>
      ) : null}

      <AlertDialog
        open={deletingNode !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingNode(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete comment?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingNode && deletingNode.childCount > 0
                ? "This comment has replies, so its text will be removed but the thread will stay in place."
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void confirmDelete()
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
