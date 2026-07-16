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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ui/base/ui/dropdown-menu"
import { Label } from "@ui/base/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@ui/base/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/base/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@ui/base/ui/avatar"
import { Markdown } from "@ui/seo-shared/Markdown"
import { RelativeTime } from "@ui/seo-shared/RelativeTime"
import { PostRow, type PostRowPost } from "@ui/seo-shared/post/PostRow"
import { CommunityIcon } from "@ui/seo-shared/community/CommunityIcon"
import { SeoLink } from "@ui/seo-shared/_internal/seo-link"
import {
  ModInsightsRail,
  type ModCommunity,
} from "@frontends/dashboard/components/mod/ModInsightsRail"
import { mediaUrl } from "@frontends/dashboard/lib/mediaUrl"
import {
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
  getApiV1CommunityMemberModeratedOptions,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import type { GetApiV1ModQueueByCommunityIdResponse } from "@lib/api-client/generated/types.gen"
import {
  ArrowDownUp,
  Cat,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  LayoutList,
  Lock,
  LockOpen,
  MoreHorizontal,
  Pin,
  Rows3,
  ShieldCheck,
  Trash2,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

type QueueTab = "needs_review" | "reported" | "removed" | "edited" | "unmoderated"
type ContentType = "all" | "posts" | "comments"
type SortOrder = "newest" | "oldest"
type ViewMode = "card" | "compact"
type QueuePage = GetApiV1ModQueueByCommunityIdResponse
type QueueItem = QueuePage["data"][number]

const TABS: { value: QueueTab; label: string }[] = [
  { value: "needs_review", label: "Needs Review" },
  { value: "reported", label: "Reported" },
  { value: "removed", label: "Removed" },
  { value: "edited", label: "Edited" },
  { value: "unmoderated", label: "Unmoderated" },
]

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: "all", label: "All content" },
  { value: "posts", label: "Posts" },
  { value: "comments", label: "Comments" },
]

const SORTS: { value: SortOrder; label: string }[] = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
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
      {item.reasons.slice(0, 6).map((r) => (
        <Badge
          key={`${r.communityRuleId ?? "none"}-${r.reasonText ?? "rule-violation"}`}
          variant="outline"
        >
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
  view,
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
  view: ViewMode
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
          variant={view}
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
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => {
            onRemove({ removalReasonId: null, asSpam: true })
          }}
        >
          <Trash2 className="size-4" />
          Spam
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="icon-sm" disabled={pending} aria-label="More actions">
                <MoreHorizontal className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            {isPost && post ? (
              <>
                <DropdownMenuItem
                  onClick={() => {
                    onToggleLock(!post.isLocked)
                  }}
                >
                  {post.isLocked ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
                  {post.isLocked ? "Unlock comments" : "Lock comments"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Sticky</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => {
                      onSticky(1)
                    }}
                  >
                    {post.stickyPosition === 1 ? (
                      <Check className="size-4" />
                    ) : (
                      <Pin className="size-4" />
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
                      <Pin className="size-4" />
                    )}
                    Slot 2
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      onSticky(null)
                    }}
                  >
                    <Pin className="size-4" />
                    Unsticky
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </>
            ) : item.comment ? (
              <DropdownMenuItem
                onClick={() => {
                  onPinComment(!item.comment!.isSticky)
                }}
              >
                <Pin className="size-4" />
                {item.comment.isSticky ? "Unpin comment" : "Pin comment"}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

function QueueTabPanel({
  communityId,
  name,
  tab,
  reasons,
  view,
  communityFilter,
  contentType,
  sort,
}: {
  communityId: string
  name: string
  tab: QueueTab
  reasons: RemovalReason[]
  view: ViewMode
  communityFilter: string
  contentType: ContentType
  sort: SortOrder
}) {
  const queryClient = useQueryClient()
  const queryKey = ["mod-queue", communityId, tab]

  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data } = await getApiV1ModQueueByCommunityId({
        path: { communityId },
        // TODO(backend): add `community`, `contentType`, and `sort` query params
        // to /api/v1/mod-queue/{communityId} so these filters page correctly on
        // the server. They are currently applied client-side over loaded pages.
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

  const allItems = query.data?.pages.flatMap((p) => p.data) ?? []
  // Client-side filter/sort until the backend supports these params (see TODO above).
  const items = allItems
    .filter((it) => {
      if (contentType === "posts" && it.targetType !== "post") return false
      if (contentType === "comments" && it.targetType !== "comment") return false
      if (communityFilter !== "all" && it.communityId !== communityFilter) return false
      return true
    })
    .toSorted((a, b) => {
      const at = new Date(a.createdAt).getTime()
      const bt = new Date(b.createdAt).getTime()
      return sort === "oldest" ? at - bt : bt - at
    })

  if (query.isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading...</p>
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-20 text-center">
        <Cat className="size-12 text-muted-foreground/50" strokeWidth={1.5} />
        <p className="text-base font-bold">Queue is clean.</p>
        <p className="text-sm text-muted-foreground">
          There's nothing in this queue that needs your attention right now.
        </p>
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
            view={view}
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
                    toast.success(asSpam ? "Removed as spam" : "Removed")
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

/** A labelled dropdown trigger used for the toolbar filter/sort controls. */
function ToolbarDropdown({
  label,
  icon,
  options,
  value,
  onChange,
  align = "start",
}: {
  label: string
  icon?: React.ReactNode
  options: { value: string; label: string; icon?: React.ReactNode }[]
  value: string
  onChange: (value: string) => void
  align?: "start" | "end"
}) {
  const current = options.find((o) => o.value === value)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm">
            {icon}
            {current?.label ?? label}
            <ChevronDown className="size-4 text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent align={align} className="max-h-72 overflow-y-auto">
        {options.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onClick={() => {
              onChange(o.value)
            }}
          >
            {o.icon ??
              (o.value === value ? <Check className="size-4" /> : <span className="size-4" />)}
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Moderation queue. `communityId` may be a community UUID or the literal "mod"
 * for the cross-community aggregate view. Matches reddit's /mod/queue layout:
 * a "Queue" heading with help + nav arrows, a toolbar of pill tabs and
 * filter/sort dropdowns plus a card/compact view toggle, and an insights rail.
 */
export function ModQueue({ communityId, name }: { communityId: string; name: string }) {
  const [tab, setTab] = useState<QueueTab>("needs_review")
  const [view, setView] = useState<ViewMode>("card")
  const [communityFilter, setCommunityFilter] = useState<string>("all")
  const [contentType, setContentType] = useState<ContentType>("all")
  const [sort, setSort] = useState<SortOrder>("newest")
  const aggregate = communityId === "mod"

  const { data: reasonData } = useQuery({
    ...getApiV1RemovalReasonByCommunityIdOptions({ path: { communityId } }),
    enabled: !aggregate,
  })
  const reasons: RemovalReason[] = reasonData?.data ?? []

  const { data: moderatedData } = useQuery(getApiV1CommunityMemberModeratedOptions())
  const moderated: ModCommunity[] = moderatedData?.data ?? []
  // The aggregate view lets you pick any moderated community; the single view
  // scopes both the toolbar and the insights rail to the current community.
  const railCommunities = aggregate ? moderated : moderated.filter((c) => c.name === name)

  const tabIndex = TABS.findIndex((t) => t.value === tab)
  function stepTab(delta: number) {
    const next = (tabIndex + delta + TABS.length) % TABS.length
    setTab(TABS[next].value)
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="min-w-0 flex-1">
        {/* Heading row */}
        <div className="mb-4 flex items-center gap-2">
          <h1 className="text-2xl font-bold">Queue</h1>
          <Popover>
            <PopoverTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label="About the mod queue">
                  <HelpCircle className="size-4" />
                </Button>
              }
            />
            <PopoverContent align="start" className="w-72 text-sm">
              <p className="font-semibold">About the queue</p>
              <p className="mt-1 text-muted-foreground">
                Review reported, removed, and unmoderated posts and comments across the communities
                you moderate. Approve to keep content up, or remove it.
              </p>
            </PopoverContent>
          </Popover>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Previous queue"
              onClick={() => {
                stepTab(-1)
              }}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next queue"
              onClick={() => {
                stepTab(1)
              }}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        {/* Toolbar row */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {TABS.map((t) => (
              <Button
                key={t.value}
                variant={tab === t.value ? "default" : "ghost"}
                size="sm"
                className="rounded-full"
                onClick={() => {
                  setTab(t.value)
                }}
              >
                {t.label}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:ml-2">
            {aggregate ? (
              <ToolbarDropdown
                label="Communities"
                options={[
                  { value: "all", label: "Communities" },
                  ...moderated.map((c) => ({
                    value: c.id,
                    label: `r/${c.name}`,
                    icon: (
                      <CommunityIcon name={c.name} iconUrl={mediaUrl(c.iconImageKey)} size="sm" />
                    ),
                  })),
                ]}
                value={communityFilter}
                onChange={setCommunityFilter}
              />
            ) : null}
            <ToolbarDropdown
              label="All content"
              options={CONTENT_TYPES}
              value={contentType}
              onChange={(v) => {
                setContentType(v as ContentType)
              }}
            />
            <ToolbarDropdown
              label="Sort"
              icon={<ArrowDownUp className="size-4" />}
              options={SORTS}
              value={sort}
              onChange={(v) => {
                setSort(v as SortOrder)
              }}
            />
          </div>

          <div className="ml-auto">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={view === "card" ? "Switch to compact view" : "Switch to card view"}
              aria-pressed={view === "compact"}
              onClick={() => {
                setView((v) => (v === "card" ? "compact" : "card"))
              }}
            >
              {view === "card" ? <LayoutList className="size-4" /> : <Rows3 className="size-4" />}
            </Button>
          </div>
        </div>

        <QueueTabPanel
          key={tab}
          communityId={communityId}
          name={name}
          tab={tab}
          reasons={reasons}
          view={view}
          communityFilter={communityFilter}
          contentType={contentType}
          sort={sort}
        />
      </div>

      {railCommunities.length > 0 ? (
        <ModInsightsRail
          communities={railCommunities}
          initialCommunityId={railCommunities[0]?.id}
        />
      ) : null}
    </div>
  )
}
