import { useMutation } from "@tanstack/react-query"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ui/base/ui/dropdown-menu"
import {
  deleteApiV1PostActionFollowByPostId,
  deleteApiV1PostActionHideByPostId,
  deleteApiV1PostActionSaveByPostId,
  deleteApiV1PostById,
  putApiV1PostActionFollowByPostId,
  putApiV1PostActionHideByPostId,
  putApiV1PostActionSaveByPostId,
  putApiV1UserBlockByUsername,
} from "@lib/api-client/generated/sdk.gen"
import {
  Bell,
  BellOff,
  Bookmark,
  EyeOff,
  Flag,
  MoreHorizontal,
  Pencil,
  Tags,
  Trash2,
  UserX,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import {
  EditPostDialog,
  type EditPostDialogPost,
} from "@frontends/dashboard/components/EditPostDialog"
import { ReportDialog } from "@frontends/dashboard/components/ReportDialog"

export type PostActionsMenuPost = EditPostDialogPost & {
  isAuthor: boolean
  author: { username: string } | null
}

export type PostActionsMenuProps = {
  post: PostActionsMenuPost
  /** Optimistically remove the post from the caller's list when hidden or deleted. */
  onHidden?: (postId: string) => void
  onDeleted?: (postId: string) => void
  /** Fire when a post is unsaved/unhidden so the Saved/Hidden tabs can drop it. */
  onUnsaved?: (postId: string) => void
  onUnhidden?: (postId: string) => void
  /** Called after an edit saves so the caller can refetch. */
  onEdited?: () => void
  /** Seed the toggle state when the caller already knows it (e.g. the Saved tab). */
  initialSaved?: boolean
  initialHidden?: boolean
  initialFollowing?: boolean
}

/**
 * Overflow ("...") menu for a post. Author variant offers edit and delete; the
 * non-author variant offers save, hide, follow, report (stub) and block author.
 * Save/hide/follow state is tracked locally after each action because the post
 * serializers don't currently expose it.
 */
export function PostActionsMenu({
  post,
  onHidden,
  onDeleted,
  onUnsaved,
  onUnhidden,
  onEdited,
  initialSaved = false,
  initialHidden = false,
  initialFollowing = false,
}: PostActionsMenuProps) {
  const [saved, setSaved] = useState(initialSaved)
  const [hidden, setHidden] = useState(initialHidden)
  const [following, setFollowing] = useState(initialFollowing)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)

  const saveMutation = useMutation({
    mutationFn: (next: boolean) =>
      next
        ? putApiV1PostActionSaveByPostId({ path: { postId: post.id }, throwOnError: true })
        : deleteApiV1PostActionSaveByPostId({ path: { postId: post.id }, throwOnError: true }),
    onSuccess: (_data, next) => {
      setSaved(next)
      if (!next) onUnsaved?.(post.id)
      toast.success(next ? "Post saved" : "Post unsaved")
    },
    onError: () => {
      toast.error("Could not update saved posts")
    },
  })

  const hideMutation = useMutation({
    mutationFn: (next: boolean) =>
      next
        ? putApiV1PostActionHideByPostId({ path: { postId: post.id }, throwOnError: true })
        : deleteApiV1PostActionHideByPostId({ path: { postId: post.id }, throwOnError: true }),
    onSuccess: (_data, next) => {
      setHidden(next)
      if (next) {
        onHidden?.(post.id)
        toast.success("Post hidden")
      } else {
        onUnhidden?.(post.id)
        toast.success("Post unhidden")
      }
    },
    onError: () => {
      toast.error("Could not hide post")
    },
  })

  const followMutation = useMutation({
    mutationFn: (next: boolean) =>
      next
        ? putApiV1PostActionFollowByPostId({ path: { postId: post.id }, throwOnError: true })
        : deleteApiV1PostActionFollowByPostId({ path: { postId: post.id }, throwOnError: true }),
    onSuccess: (_data, next) => {
      setFollowing(next)
      toast.success(next ? "Following this post" : "Unfollowed this post")
    },
    onError: () => {
      toast.error("Could not update following")
    },
  })

  const blockMutation = useMutation({
    mutationFn: (username: string) =>
      putApiV1UserBlockByUsername({ path: { username }, throwOnError: true }),
    onSuccess: () => {
      toast.success(post.author ? `Blocked u/${post.author.username}` : "User blocked")
    },
    onError: () => {
      toast.error("Could not block user")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteApiV1PostById({ path: { id: post.id }, throwOnError: true }),
    onSuccess: () => {
      onDeleted?.(post.id)
      toast.success("Post deleted")
    },
    onError: () => {
      toast.error("Could not delete post")
    },
  })

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Post actions"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {post.isAuthor ? (
            <>
              <DropdownMenuItem
                onClick={() => {
                  setEditOpen(true)
                }}
              >
                <Pencil className="size-4" />
                Edit post
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setEditOpen(true)
                }}
              >
                <Tags className="size-4" />
                Edit tags
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  setDeleteOpen(true)
                }}
              >
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem
                disabled={saveMutation.isPending}
                onClick={() => {
                  saveMutation.mutate(!saved)
                }}
              >
                <Bookmark className="size-4" />
                {saved ? "Unsave" : "Save"}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={hideMutation.isPending}
                onClick={() => {
                  hideMutation.mutate(!hidden)
                }}
              >
                <EyeOff className="size-4" />
                {hidden ? "Unhide" : "Hide"}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={followMutation.isPending}
                onClick={() => {
                  followMutation.mutate(!following)
                }}
              >
                {following ? <BellOff className="size-4" /> : <Bell className="size-4" />}
                {following ? "Unfollow post" : "Follow post"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!post.community}
                onClick={() => {
                  setReportOpen(true)
                }}
              >
                <Flag className="size-4" />
                Report
              </DropdownMenuItem>
              {post.author ? (
                <DropdownMenuItem
                  variant="destructive"
                  disabled={blockMutation.isPending}
                  onClick={() => {
                    if (post.author) blockMutation.mutate(post.author.username)
                  }}
                >
                  <UserX className="size-4" />
                  Block author
                </DropdownMenuItem>
              ) : null}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {post.isAuthor ? (
        <EditPostDialog post={post} open={editOpen} onOpenChange={setEditOpen} onSaved={onEdited} />
      ) : null}

      {post.community ? (
        <ReportDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          communityId={post.community.id}
          target={{ type: "post", id: post.id }}
        />
      ) : null}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes your post. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault()
                deleteMutation.mutate()
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
