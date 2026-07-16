import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { cn } from "@ui/base/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ui/base/ui/dialog"
import { Label } from "@ui/base/ui/label"
import { LoadingButton } from "@ui/base/ui/loading-button"
import { Switch } from "@ui/base/ui/switch"
import { Markdown } from "@ui/seo-shared/Markdown"
import { MarkdownEditor } from "@ui/spa-shared/MarkdownEditor"
import {
  getApiV1FlairByCommunityIdPostTemplatesOptions,
  getApiV1PostByIdOptions,
  patchApiV1PostByIdMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { useEffect, useState } from "react"
import { toast } from "sonner"

export type EditPostDialogPost = {
  id: string
  type: string
  bodyMd: string | null
  isNsfw: boolean
  isSpoiler: boolean
  isOc: boolean
  community: { id: string; name: string } | null
  flair: { id: string } | null
}

export type EditPostDialogProps = {
  post: EditPostDialogPost
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after a successful save so the caller can refresh its own view. */
  onSaved?: () => void
}

function FlairField({
  communityId,
  value,
  onChange,
}: {
  communityId: string
  value: string | null
  onChange: (id: string | null) => void
}) {
  const { data } = useQuery({
    ...getApiV1FlairByCommunityIdPostTemplatesOptions({ path: { communityId } }),
  })
  const templates = (data?.data ?? []).filter((t) => !t.modOnly)
  if (templates.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <Label>Flair</Label>
      <div className="flex flex-wrap gap-2">
        {templates.map((t) => {
          const selected = t.id === value
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                onChange(selected ? null : t.id)
              }}
              style={
                t.bgColor || t.textColor
                  ? { backgroundColor: t.bgColor ?? undefined, color: t.textColor ?? undefined }
                  : undefined
              }
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                selected ? "ring-2 ring-primary ring-offset-1" : "hover:bg-muted",
              )}
            >
              {t.text}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Edit an existing post's body (text posts only) and tags/flair. Wraps the shared
 * MarkdownEditor and PATCHes /v1/post/:id, then invalidates the post detail and any
 * cached feeds so the change shows everywhere.
 */
export function EditPostDialog({ post, open, onOpenChange, onSaved }: EditPostDialogProps) {
  const queryClient = useQueryClient()
  const isText = post.type === "text"

  const [bodyMd, setBodyMd] = useState(post.bodyMd ?? "")
  const [isNsfw, setIsNsfw] = useState(post.isNsfw)
  const [isSpoiler, setIsSpoiler] = useState(post.isSpoiler)
  const [isOc, setIsOc] = useState(post.isOc)
  const [flairTemplateId, setFlairTemplateId] = useState<string | null>(post.flair?.id ?? null)

  // Re-seed from the post whenever the dialog opens so edits always start fresh.
  useEffect(() => {
    if (open) {
      setBodyMd(post.bodyMd ?? "")
      setIsNsfw(post.isNsfw)
      setIsSpoiler(post.isSpoiler)
      setIsOc(post.isOc)
      setFlairTemplateId(post.flair?.id ?? null)
    }
  }, [open, post])

  const mutation = useMutation({
    ...patchApiV1PostByIdMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: getApiV1PostByIdOptions({ path: { id: post.id } }).queryKey,
      })
      void queryClient.invalidateQueries({ queryKey: ["feed"] })
      toast.success("Post updated")
      onSaved?.()
      onOpenChange(false)
    },
    onError: () => {
      toast.error("Could not update post")
    },
  })

  function save() {
    mutation.mutate({
      path: { id: post.id },
      body: {
        bodyMd: isText ? bodyMd : undefined,
        isNsfw,
        isSpoiler,
        isOc,
        flairTemplateId,
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit post</DialogTitle>
          <DialogDescription>
            {isText
              ? "Update the text of your post and its tags."
              : "Update this post's tags and flair."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {isText ? (
            <MarkdownEditor
              value={bodyMd}
              onChange={setBodyMd}
              renderPreview={(md) => <Markdown content={md} />}
            />
          ) : null}

          <div className="flex flex-col gap-3 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-nsfw">NSFW</Label>
              <Switch id="edit-nsfw" checked={isNsfw} onCheckedChange={setIsNsfw} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-spoiler">Spoiler</Label>
              <Switch id="edit-spoiler" checked={isSpoiler} onCheckedChange={setIsSpoiler} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-oc">Original Content</Label>
              <Switch id="edit-oc" checked={isOc} onCheckedChange={setIsOc} />
            </div>
          </div>

          {post.community ? (
            <FlairField
              communityId={post.community.id}
              value={flairTemplateId}
              onChange={setFlairTemplateId}
            />
          ) : null}
        </div>

        <DialogFooter>
          <LoadingButton loading={mutation.isPending} onClick={save}>
            Save changes
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
