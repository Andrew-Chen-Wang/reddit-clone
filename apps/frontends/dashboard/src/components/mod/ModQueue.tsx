import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query"
import { Badge } from "@ui/base/ui/badge"
import { Button } from "@ui/base/ui/button"
import { Checkbox } from "@ui/base/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ui/base/ui/dropdown-menu"
import { Label } from "@ui/base/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@ui/base/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/base/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ui/base/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@ui/base/ui/avatar"
import { Markdown } from "@ui/seo-shared/Markdown"
import { RelativeTime } from "@ui/seo-shared/RelativeTime"
import { PostRow, type PostRowPost } from "@ui/seo-shared/post/PostRow"
import { SeoLink } from "@ui/seo-shared/_internal/seo-link"
import { mediaUrl } from "@frontends/dashboard/lib/mediaUrl"
import {
  getApiV1ModLogByCommunityId,
  getApiV1ModQueueByCommunityId,
  putApiV1PostVoteByPostId,
} from "@lib/api-client/generated/sdk.gen"
import {
  postApiV1ModQueueApproveMutation,
  postApiV1ModQueueLockMutation,
  postApiV1ModQueueRemoveMutation,
  postApiV1ModQueueStickyCommentMutation,
  postApiV1ModQueueStickyMutation,
  postApiV1ModQueueUnlockMutation,
  getApiV1RemovalReasonByCommunityIdOptions,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import type { GetApiV1ModQueueByCommunityIdResponse } from "@lib/api-client/generated/types.gen"
import { Check, Lock, LockOpen, Pin, ShieldCheck, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

type QueueTab = "needs_review" | "reported" | "removed" | "edited" | "unmoderated"
type QueuePage = GetApiV1ModQueueByCommunityIdResponse
type QueueItem = QueuePage["data"][number]

const TABS: { value: QueueTab; label: string }[] = [
  { value: "needs_review", label: "Needs Review" },
  { value: "reported", label: "Reported" },
  { value: "removed", label: "Removed" },
  { value: "edited", label: "Edited" },
  { value: "unmoderated", label: "Unmoderated" },
]

function itemKey(item: QueueItem): string {
  return item.targetType === "post" ? `post:${item.post?.id}` : `comment:${item.comment?.id}`
}

function toPostRowPost(post: NonNullable<QueueItem["post"]>): PostRowPost {
  return {
    id: post.id,
    type: post.type,
    title: post.title,
    bodyMd: post.bodyMd,
    linkUrl: post.linkUrl,
    isNsfw: post.isNsfw,
    isSpoiler: post.isSpoiler,
    isOc: post.isOc,
    isLocked: post.isLocked,
    stickyPosition: post.stickyPosition,
    score: post.score,
    commentCount: post.commentCount,
    createdAt: post.createdAt,
    editedAt: post.editedAt,
    userVote: post.userVote,
    author: post.author
      ? { username: post.author.username, displayName: post.author.displayName }
      : null,
    community: post.community
      ? {
          name: post.community.name,
          displayName: post.community.displayName,
          iconImageKey: mediaUrl(post.community.iconImageKey),
        }
      : null,
    flair: post.flair
      ? { text: post.flair.text, bgColor: post.flair.bgColor, textColor: post.flair.textColor }
      : null,
    media: post.media,
  }
}

type RemovalReason = { id: string; title: string; message: string; position: number }

/** Report chips: total count plus each distinct reported rule/reason. */
function ReportChips({ item }: { item: QueueItem }) {
  if (item.reportCount === 0 && item.reasons.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {item.reportCount > 0 ? (
        <Badge variant="destructive">
          {item.reportCount} {item.reportCount === 1 ? "report" : "reports"}
        </Badge>
      ) : null}
      {item.reasons.slice(0, 6).map((r, i) => (
        <Badge key={i} variant="outline">
          {r.reasonText ?? "Rule violation"}
        </Badge>
      ))}
      {item.isSpam ? <Badge variant="secondary">Spam</Badge> : null}
    </div>
  )
}

function RemovePopover({
  reasons,
  disabled,
  onRemove,
}: {
  reasons: RemovalReason[]
  disabled?: boolean
  onRemove: (args: { removalReasonId: string | null; asSpam: boolean }) => void
}) {
  const [open, setOpen] = useState(false)
  const [reasonId, setReasonId] = useState<string>("none")
  const [asSpam, setAsSpam] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" disabled={disabled}>
            <Trash2 className="size-4" />
            Remove
          </Button>
        }
      />
      <PopoverContent align="end" className="w-72">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold">Remove content</p>
          {reasons.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <Label>Removal reason</Label>
              <Select
                items={{
                  none: "No reason",
                  ...Object.fromEntries(reasons.map((r) => [r.id, r.title])),
                }}
                value={reasonId}
                onValueChange={(v) => {
                  setReasonId(v ?? "none")
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No reason</SelectItem>
                  {reasons.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <Label className="flex items-center gap-2">
            <Checkbox
              checked={asSpam}
              onCheckedChange={(v) => {
                setAsSpam(v)
              }}
            />
            Mark as spam
          </Label>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setOpen(false)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                onRemove({ removalReasonId: reasonId === "none" ? null : reasonId, asSpam })
                setOpen(false)
              }}
            >
              Remove
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function CommentCard({ item, name }: { item: QueueItem; name: string }) {
  const comment = item.comment
  if (!comment) return null
  const author = comment.author
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Avatar className="size-5">
          {author?.avatarImageKey ? (
            <AvatarImage src={mediaUrl(author.avatarImageKey) ?? undefined} alt="" />
          ) : null}
          <AvatarFallback className="text-[9px]">
            {author ? author.username.slice(0, 2).toUpperCase() : "?"}
          </AvatarFallback>
        </Avatar>
        <span className="font-medium text-foreground">
          {author ? `u/${author.username}` : "[deleted]"}
        </span>
        {comment.isSticky ? <Badge variant="secondary">Pinned</Badge> : null}
        <span aria-hidden>·</span>
        <RelativeTime date={comment.createdAt} />
        {comment.editedAt ? <span className="italic">(edited)</span> : null}
        <SeoLink
          href={`/r/${name}/comments/${comment.postId}`}
          className="ml-auto text-primary hover:underline"
        >
          View thread
        </SeoLink>
      </div>
      <div className="text-sm">
        {comment.bodyMd ? (
          <Markdown content={comment.bodyMd} />
        ) : (
          <p className="italic text-muted-foreground">[removed]</p>
        )}
      </div>
    </div>
  )
}

function QueueRow({
  item,
  name,
  reasons,
  onVote,
  onApprove,
  onRemove,
  onToggleLock,
  onSticky,
  onPinComment,
  pending,
}: {
  item: QueueItem
  name: string
  reasons: RemovalReason[]
  onVote: (postId: string, direction: 1 | -1) => void
  onApprove: () => void
  onRemove: (args: { removalReasonId: string | null; asSpam: boolean }) => void
  onToggleLock: (locked: boolean) => void
  onSticky: (position: 1 | 2 | null) => void
  onPinComment: (sticky: boolean) => void
  pending: boolean
}) {
  const isPost = item.targetType === "post"
  const post = item.post
  const communityName = post?.community?.name ?? name

  return (
    <div className="flex flex-col gap-2 border-b py-3 last:border-b-0">
      <ReportChips item={item} />
      {isPost && post ? (
        <PostRow
          post={toPostRowPost(post)}
          variant="compact"
          href={`/r/${communityName}/comments/${post.id}`}
          communityHref={`/r/${communityName}`}
          authorHref={post.author ? `/user/${post.author.username}` : undefined}
          onUpvote={() => {
            onVote(post.id, 1)
          }}
          onDownvote={() => {
            onVote(post.id, -1)
          }}
          showCommunity
        />
      ) : (
        <CommentCard item={item} name={communityName} />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" disabled={pending} onClick={onApprove}>
          <ShieldCheck className="size-4" />
          Approve
        </Button>
        <RemovePopover reasons={reasons} disabled={pending} onRemove={onRemove} />
        {isPost && post ? (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => {
                onToggleLock(!post.isLocked)
              }}
            >
              {post.isLocked ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
              {post.isLocked ? "Unlock" : "Lock"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm" disabled={pending}>
                    <Pin className="size-4" />
                    Sticky
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    onSticky(1)
                  }}
                >
                  {post.stickyPosition === 1 ? (
                    <Check className="size-4" />
                  ) : (
                    <span className="size-4" />
                  )}
                  Slot 1
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    onSticky(2)
                  }}
                >
                  {post.stickyPosition === 2 ? (
                    <Check className="size-4" />
                  ) : (
                    <span className="size-4" />
                  )}
                  Slot 2
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    onSticky(null)
                  }}
                >
                  <span className="size-4" />
                  Unsticky
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : item.comment ? (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => {
              onPinComment(!item.comment!.isSticky)
            }}
          >
            <Pin className="size-4" />
            {item.comment.isSticky ? "Unpin" : "Pin"}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

/** Right rail: rough last-7-days activity computed from mod-log page 1. */
function InsightsRail({ communityId }: { communityId: string }) {
  const { data } = useQuery({
    queryKey: ["mod-log-insights", communityId],
    queryFn: async () => {
      const res = await getApiV1ModLogByCommunityId({
        path: { communityId },
        throwOnError: true,
      })
      return res.data
    },
  })

  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  const recent = (data?.data ?? []).filter((e) => new Date(e.createdAt).getTime() >= cutoff)
  const mods = new Set(recent.map((e) => e.modUserId).filter(Boolean))
  const byAction = new Map<string, number>()
  for (const e of recent) byAction.set(e.action, (byAction.get(e.action) ?? 0) + 1)
  const topActions = [...byAction.entries()].toSorted((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <aside className="w-full shrink-0 lg:w-64">
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Insights and activity</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Last 7 days (from mod log, approximate)
        </p>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Mod actions</span>
            <span className="font-medium">{recent.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Active mods</span>
            <span className="font-medium">{mods.size}</span>
          </div>
          {topActions.map(([action, count]) => (
            <div key={action} className="flex items-center justify-between">
              <span className="truncate text-muted-foreground">{action.replaceAll("_", " ")}</span>
              <span className="font-medium">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

function QueueTabPanel({
  communityId,
  name,
  tab,
  reasons,
}: {
  communityId: string
  name: string
  tab: QueueTab
  reasons: RemovalReason[]
}) {
  const queryClient = useQueryClient()
  const queryKey = ["mod-queue", communityId, tab]

  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data } = await getApiV1ModQueueByCommunityId({
        path: { communityId },
        query: { tab, cursor: pageParam },
        throwOnError: true,
      })
      return data
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })

  function dropItem(key: string) {
    queryClient.setQueryData<InfiniteData<QueuePage>>(queryKey, (old) =>
      old
        ? {
            ...old,
            pages: old.pages.map((p) => ({
              ...p,
              data: p.data.filter((it) => itemKey(it) !== key),
            })),
          }
        : old,
    )
  }

  function patchPost(key: string, patch: Partial<NonNullable<QueueItem["post"]>>) {
    queryClient.setQueryData<InfiniteData<QueuePage>>(queryKey, (old) =>
      old
        ? {
            ...old,
            pages: old.pages.map((p) => ({
              ...p,
              data: p.data.map((it) =>
                itemKey(it) === key && it.post ? { ...it, post: { ...it.post, ...patch } } : it,
              ),
            })),
          }
        : old,
    )
  }

  const approve = useMutation(postApiV1ModQueueApproveMutation())
  const remove = useMutation(postApiV1ModQueueRemoveMutation())
  const lock = useMutation(postApiV1ModQueueLockMutation())
  const unlock = useMutation(postApiV1ModQueueUnlockMutation())
  const sticky = useMutation(postApiV1ModQueueStickyMutation())
  const stickyComment = useMutation(postApiV1ModQueueStickyCommentMutation())

  const pending =
    approve.isPending ||
    remove.isPending ||
    lock.isPending ||
    unlock.isPending ||
    sticky.isPending ||
    stickyComment.isPending

  function vote(postId: string, direction: 1 | -1) {
    const key = `post:${postId}`
    let targetValue: 1 | 0 | -1 = direction
    queryClient.setQueryData<InfiniteData<QueuePage>>(queryKey, (old) =>
      old
        ? {
            ...old,
            pages: old.pages.map((p) => ({
              ...p,
              data: p.data.map((it) => {
                if (itemKey(it) !== key || !it.post) return it
                const prev = it.post.userVote
                const next = prev === direction ? 0 : direction
                targetValue = next
                return {
                  ...it,
                  post: { ...it.post, userVote: next, score: it.post.score - prev + next },
                }
              }),
            })),
          }
        : old,
    )
    void putApiV1PostVoteByPostId({
      path: { postId },
      body: { value: targetValue },
      throwOnError: true,
    }).catch(() => {
      void query.refetch()
      toast.error("Could not register your vote")
    })
  }

  const items = query.data?.pages.flatMap((p) => p.data) ?? []

  if (query.isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading...</p>
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <ShieldCheck className="size-8 text-muted-foreground/60" />
        <p className="text-sm font-medium">Queue is clean.</p>
        <p className="text-xs text-muted-foreground">Nothing here needs your attention.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {items.map((item) => {
        const key = itemKey(item)
        return (
          <QueueRow
            key={key}
            item={item}
            name={name}
            reasons={reasons}
            pending={pending}
            onVote={vote}
            onApprove={() => {
              const body =
                item.targetType === "post"
                  ? { postId: item.post?.id }
                  : { commentId: item.comment?.id }
              approve.mutate(
                { body },
                {
                  onSuccess: () => {
                    dropItem(key)
                    toast.success("Approved")
                  },
                  onError: () => {
                    toast.error("Could not approve")
                  },
                },
              )
            }}
            onRemove={({ removalReasonId, asSpam }) => {
              const body =
                item.targetType === "post"
                  ? { postId: item.post?.id, removalReasonId, asSpam }
                  : { commentId: item.comment?.id, removalReasonId, asSpam }
              remove.mutate(
                { body },
                {
                  onSuccess: () => {
                    dropItem(key)
                    toast.success("Removed")
                  },
                  onError: () => {
                    toast.error("Could not remove")
                  },
                },
              )
            }}
            onToggleLock={(locked) => {
              const postId = item.post?.id
              if (!postId) return
              const m = locked ? lock : unlock
              m.mutate(
                { body: { postId } },
                {
                  onSuccess: () => {
                    patchPost(key, { isLocked: locked })
                    toast.success(locked ? "Post locked" : "Post unlocked")
                  },
                  onError: () => {
                    toast.error("Could not update lock")
                  },
                },
              )
            }}
            onSticky={(position) => {
              const postId = item.post?.id
              if (!postId) return
              sticky.mutate(
                { body: { postId, position } },
                {
                  onSuccess: () => {
                    patchPost(key, { stickyPosition: position })
                    toast.success(position === null ? "Unstickied" : `Stickied to slot ${position}`)
                  },
                  onError: () => {
                    toast.error("Could not sticky post")
                  },
                },
              )
            }}
            onPinComment={(stickyValue) => {
              const commentId = item.comment?.id
              if (!commentId) return
              stickyComment.mutate(
                { body: { commentId, sticky: stickyValue } },
                {
                  onSuccess: () => {
                    dropItem(key)
                    toast.success(stickyValue ? "Comment pinned" : "Comment unpinned")
                  },
                  onError: () => {
                    toast.error("Could not update comment")
                  },
                },
              )
            }}
          />
        )
      })}
      {query.hasNextPage ? (
        <div className="pt-4 text-center">
          <Button
            variant="outline"
            size="sm"
            disabled={query.isFetchingNextPage}
            onClick={() => {
              void query.fetchNextPage()
            }}
          >
            {query.isFetchingNextPage ? "Loading..." : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Moderation queue. `communityId` may be a community UUID or the literal "mod"
 * for the cross-community aggregate view (in which the per-community removal
 * reasons and insights rail are omitted).
 */
export function ModQueue({ communityId, name }: { communityId: string; name: string }) {
  const [tab, setTab] = useState<QueueTab>("needs_review")
  const aggregate = communityId === "mod"

  const { data: reasonData } = useQuery({
    ...getApiV1RemovalReasonByCommunityIdOptions({ path: { communityId } }),
    enabled: !aggregate,
  })
  const reasons: RemovalReason[] = reasonData?.data ?? []

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="min-w-0 flex-1">
        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as QueueTab)
          }}
        >
          <TabsList className="flex-wrap">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {TABS.map((t) => (
            <TabsContent key={t.value} value={t.value} className="mt-4">
              {tab === t.value ? (
                <QueueTabPanel
                  communityId={communityId}
                  name={name}
                  tab={t.value}
                  reasons={reasons}
                />
              ) : null}
            </TabsContent>
          ))}
        </Tabs>
      </div>
      {aggregate ? null : <InsightsRail communityId={communityId} />}
    </div>
  )
}
