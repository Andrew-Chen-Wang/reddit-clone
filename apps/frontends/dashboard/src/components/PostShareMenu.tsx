import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@ui/base/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ui/base/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ui/base/ui/dropdown-menu"
import { Label } from "@ui/base/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/base/ui/select"
import { Textarea } from "@ui/base/ui/textarea"
import { cn } from "@ui/base/lib/utils"
import { getApiV1CommunityMemberMineOptions } from "@lib/api-client/generated/@tanstack/react-query.gen"
import { postApiV1Post, postApiV1PostActionShareByPostId } from "@lib/api-client/generated/sdk.gen"
import { Code2, Copy, Repeat2, Share2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

export type PostShareMenuPost = {
  id: string
  title: string
  community: { name: string } | null
}

export type PostShareMenuProps = {
  post: PostShareMenuPost
  /** Path (not absolute URL) to the post's permalink, e.g. /r/foo/comments/123. */
  permalink: string
  /** Match PostRow's footer button styling when rendered inline. */
  className?: string
}

const FOOTER_BUTTON =
  "inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/70"

function absoluteUrl(path: string): string {
  if (typeof window === "undefined") return path
  return `${window.location.origin}${path}`
}

function CrosspostDialog({
  post,
  open,
  onOpenChange,
}: {
  post: PostShareMenuPost
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const { data } = useQuery({ ...getApiV1CommunityMemberMineOptions(), enabled: open })
  const communities = data?.data ?? []
  const [targetId, setTargetId] = useState<string>("")
  const [title, setTitle] = useState(post.title)

  // The backend records the source via `crosspostOfPostId` on the normal create
  // route; a crosspost is a titled `text` post that references the original.
  const create = useMutation({
    mutationFn: async () =>
      postApiV1Post({
        body: {
          communityId: targetId,
          type: "text",
          title: title.trim(),
          crosspostOfPostId: post.id,
        },
        throwOnError: true,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: getApiV1CommunityMemberMineOptions().queryKey,
      })
      toast.success("Crossposted")
      onOpenChange(false)
    },
    onError: () => toast.error("Could not crosspost"),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Crosspost</DialogTitle>
          <DialogDescription>Share this post to a community you belong to.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Community</Label>
            <Select
              value={targetId}
              onValueChange={(v) => {
                setTargetId(v ?? "")
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a community" />
              </SelectTrigger>
              <SelectContent>
                {communities.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    r/{c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="crosspost-title">Title</Label>
            <Textarea
              id="crosspost-title"
              value={title}
              rows={2}
              onChange={(e) => {
                setTitle(e.target.value)
              }}
            />
          </div>

          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Crossposting {post.community ? `r/${post.community.name} · ` : ""}original post
            </p>
            <p className="mt-1 line-clamp-2 text-sm font-semibold">{post.title}</p>
          </div>
        </div>

        <DialogFooter>
          <Button
            disabled={!targetId || title.trim().length === 0 || create.isPending}
            onClick={() => {
              create.mutate()
            }}
          >
            {create.isPending ? "Crossposting…" : "Crosspost"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EmbedDialog({
  permalink,
  open,
  onOpenChange,
}: {
  permalink: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const url = absoluteUrl(permalink)
  const snippet = `<iframe src="${url}" width="640" height="480" style="border:1px solid #ccc;border-radius:8px" title="ReadIt post" loading="lazy"></iframe>`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Embed this post</DialogTitle>
          <DialogDescription>Copy the HTML snippet to embed this post elsewhere.</DialogDescription>
        </DialogHeader>
        <Textarea readOnly rows={4} value={snippet} className="font-mono text-xs" />
        <DialogFooter>
          <Button
            onClick={() => {
              void navigator.clipboard.writeText(snippet)
              toast.success("Embed code copied")
            }}
          >
            <Copy className="size-4" />
            Copy code
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Standalone Crosspost button (reddit's retweet/repeat icon) plus its dialog.
 * Rendered next to the Share menu — crossposting is no longer buried inside Share.
 */
export function PostCrosspostButton({
  post,
  className,
}: {
  post: PostShareMenuPost
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-label="Crosspost"
        className={cn(FOOTER_BUTTON, className)}
        onClick={() => {
          setOpen(true)
        }}
      >
        <Repeat2 className="size-4" />
      </button>
      <CrosspostDialog post={post} open={open} onOpenChange={setOpen} />
    </>
  )
}

/**
 * Share dropdown for a post: copy permalink (records a share) or copy an embed
 * snippet. Mirrors reddit's share menu; crosspost lives in its own button now.
 * Replaces the plain share button on PostRow / the post detail card via `shareSlot`.
 */
export function PostShareMenu({ post, permalink, className }: PostShareMenuProps) {
  const [embedOpen, setEmbedOpen] = useState(false)

  function copyLink() {
    void navigator.clipboard.writeText(absoluteUrl(permalink))
    void postApiV1PostActionShareByPostId({ path: { postId: post.id } }).catch(() => {
      // Recording the share is best-effort; the link is already copied.
    })
    toast.success("Link copied")
  }

  return (
    <div className="flex items-center gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger className={cn(FOOTER_BUTTON, className)}>
          <Share2 className="size-4" />
          Share
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={copyLink}>
            <Copy className="size-4" />
            Copy link
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setEmbedOpen(true)
            }}
          >
            <Code2 className="size-4" />
            Embed
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <PostCrosspostButton post={post} />

      <EmbedDialog permalink={permalink} open={embedOpen} onOpenChange={setEmbedOpen} />
    </div>
  )
}
