import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { cn } from "@ui/base/lib/utils"
import { Button } from "@ui/base/ui/button"
import { Input } from "@ui/base/ui/input"
import { Label } from "@ui/base/ui/label"
import { LoadingButton } from "@ui/base/ui/loading-button"
import { Popover, PopoverContent, PopoverTrigger } from "@ui/base/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/base/ui/select"
import { Switch } from "@ui/base/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@ui/base/ui/tabs"
import { CommunityIcon } from "@ui/seo-shared/community/CommunityIcon"
import { Markdown } from "@ui/seo-shared/Markdown"
import { MarkdownEditor } from "@ui/spa-shared/MarkdownEditor"
import {
  getApiV1CommunityMemberMineOptions,
  getApiV1DraftOptions,
  getApiV1FlairByCommunityIdPostTemplatesOptions,
  postApiV1DraftMutation,
  postApiV1PostMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import {
  deleteApiV1DraftById,
  postApiV1MediaConfirm,
  postApiV1Post,
} from "@lib/api-client/generated/sdk.gen"
import { DraftsDialog, type DraftItem } from "@frontends/dashboard/components/DraftsDialog"
import { ScheduleDialog } from "@frontends/dashboard/components/ScheduleDialog"
import {
  MAX_MEDIA_FILES,
  mediaTypeOf,
  readImageDimensions,
  uploadToPresigned,
  validateMediaFile,
  type MediaDraft,
} from "@frontends/dashboard/lib/mediaUpload"
import {
  Clock,
  Film,
  FileText,
  Image,
  Link2,
  Loader2,
  Save,
  TagIcon,
  Type,
  Upload,
  X,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

const TITLE_MAX = 300

type PostType = "text" | "link" | "media"

const ACCEPT_ATTR = "image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm"

export type SubmitFormCommunity = { id: string; name: string; displayName: string | null }

export type SubmitFormProps = {
  /** When set, the community is fixed (r/name/submit). Otherwise a picker is shown. */
  fixedCommunity?: SubmitFormCommunity
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function FlairPicker({
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

function MediaTile({ draft, onRemove }: { draft: MediaDraft; onRemove: () => void }) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-md border bg-muted">
      {draft.mediaType === "video" ? (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <Film className="size-8" />
        </div>
      ) : (
        // oxlint-disable-next-line no-img-element
        <img src={draft.previewUrl} alt="" className="h-full w-full object-cover" />
      )}

      {draft.status === "uploading" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50 text-white">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-xs font-medium">{draft.progress}%</span>
        </div>
      ) : null}
      {draft.status === "done" ? (
        <div className="absolute inset-x-0 bottom-0 bg-green-600/80 py-0.5 text-center text-[10px] font-medium text-white">
          Uploaded
        </div>
      ) : null}
      {draft.status === "error" ? (
        <div className="absolute inset-x-0 bottom-0 bg-destructive/80 py-0.5 text-center text-[10px] font-medium text-white">
          Failed
        </div>
      ) : null}

      <button
        type="button"
        aria-label="Remove"
        onClick={onRemove}
        className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

function MediaPicker({
  drafts,
  onAdd,
  onRemove,
  disabled,
}: {
  drafts: MediaDraft[]
  onAdd: (files: FileList | null) => void
  onRemove: (id: string) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragActive, setDragActive] = useState(false)

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        aria-label="Upload media"
        disabled={disabled}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragActive(true)
        }}
        onDragLeave={() => {
          setDragActive(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setDragActive(false)
          if (!disabled) onAdd(e.dataTransfer.files)
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-8 text-center transition-colors",
          dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25",
          disabled ? "opacity-60" : "cursor-pointer hover:border-muted-foreground/40",
        )}
        onClick={() => {
          if (!disabled) inputRef.current?.click()
        }}
      >
        <Upload className="size-6 text-muted-foreground" />
        <span className="text-sm font-medium">Drag & drop or click to upload</span>
        <span className="text-xs text-muted-foreground">
          Images (JPEG, PNG, GIF, WebP up to 20MB) or video (MP4, WebM up to 200MB). Up to{" "}
          {MAX_MEDIA_FILES} files.
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        aria-label="Upload media files"
        accept={ACCEPT_ATTR}
        multiple
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          onAdd(e.target.files)
          e.target.value = ""
        }}
      />

      {drafts.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {drafts.map((draft) => (
            <MediaTile
              key={draft.id}
              draft={draft}
              onRemove={() => {
                onRemove(draft.id)
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function SubmitForm({ fixedCommunity }: SubmitFormProps) {
  const navigate = useNavigate()
  const { data: mine } = useQuery({
    ...getApiV1CommunityMemberMineOptions(),
    enabled: !fixedCommunity,
  })

  const [pickedId, setPickedId] = useState<string | null>(null)
  const communities = mine?.data ?? []
  const picked = communities.find((c) => c.id === pickedId)
  const community: SubmitFormCommunity | undefined =
    fixedCommunity ??
    (picked ? { id: picked.id, name: picked.name, displayName: picked.displayName } : undefined)

  const [type, setType] = useState<PostType>("text")
  const [title, setTitle] = useState("")
  const [bodyMd, setBodyMd] = useState("")
  const [linkUrl, setLinkUrl] = useState("")
  const [isNsfw, setIsNsfw] = useState(false)
  const [isSpoiler, setIsSpoiler] = useState(false)
  const [isOc, setIsOc] = useState(false)
  const [flairTemplateId, setFlairTemplateId] = useState<string | null>(null)
  const [mediaDrafts, setMediaDrafts] = useState<MediaDraft[]>([])
  const [uploading, setUploading] = useState(false)

  const queryClient = useQueryClient()
  const [loadedDraftId, setLoadedDraftId] = useState<string | null>(null)
  const [draftsOpen, setDraftsOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)

  function loadDraft(draft: DraftItem) {
    const draftType = (draft.type ?? "text") as PostType
    setType(draftType === "media" ? "text" : draftType)
    setTitle(draft.title ?? "")
    setBodyMd(draft.bodyMd ?? "")
    setLinkUrl(draft.linkUrl ?? "")
    setIsNsfw(draft.isNsfw)
    setIsSpoiler(draft.isSpoiler)
    setIsOc(draft.isOc)
    setFlairTemplateId(draft.flairTemplateId)
    if (!fixedCommunity && draft.communityId) setPickedId(draft.communityId)
    setLoadedDraftId(draft.id)
    toast.success("Draft loaded")
  }

  function clearLoadedDraft() {
    if (loadedDraftId) {
      void deleteApiV1DraftById({ path: { id: loadedDraftId } }).catch(() => {
        // Best-effort cleanup; the post already succeeded.
      })
      setLoadedDraftId(null)
    }
  }

  const saveDraft = useMutation({
    ...postApiV1DraftMutation(),
    onSuccess: async () => {
      const fresh = await queryClient.fetchQuery(getApiV1DraftOptions())
      toast.success(`Draft saved (${fresh.count}/${fresh.max})`)
    },
    onError: () => {
      toast.error("Could not save draft")
    },
  })

  // Revoke object URLs on unmount so previews don't leak.
  const draftsRef = useRef(mediaDrafts)
  draftsRef.current = mediaDrafts
  useEffect(() => {
    return () => {
      for (const draft of draftsRef.current) URL.revokeObjectURL(draft.previewUrl)
    }
  }, [])

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const incoming = Array.from(files)
    const accepted: MediaDraft[] = []
    for (const file of incoming) {
      if (mediaDrafts.length + accepted.length >= MAX_MEDIA_FILES) {
        toast.error(`You can attach up to ${MAX_MEDIA_FILES} files.`)
        break
      }
      const error = validateMediaFile(file)
      if (error) {
        toast.error(error)
        continue
      }
      const draft: MediaDraft = {
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        mediaType: mediaTypeOf(file),
        width: null,
        height: null,
        status: "idle",
        progress: 0,
      }
      accepted.push(draft)
      void readImageDimensions(file).then((dims) => {
        if (!dims) return
        setMediaDrafts((prev) =>
          prev.map((d) =>
            d.id === draft.id ? { ...d, width: dims.width, height: dims.height } : d,
          ),
        )
      })
    }
    if (accepted.length > 0) setMediaDrafts((prev) => [...prev, ...accepted])
  }

  function removeDraft(id: string) {
    setMediaDrafts((prev) => {
      const target = prev.find((d) => d.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((d) => d.id !== id)
    })
  }

  function patchDraft(id: string, patch: Partial<MediaDraft>) {
    setMediaDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  }

  const createPost = useMutation({
    ...postApiV1PostMutation(),
    onSuccess: (result) => {
      clearLoadedDraft()
      if (community) {
        void navigate({
          to: "/r/$name/comments/$",
          params: { name: community.name, _splat: result.id },
        })
      }
    },
    onError: () => {
      toast.error("Could not create post")
    },
  })

  const titleValid = title.trim().length > 0 && title.length <= TITLE_MAX
  const linkValid = type === "link" ? isValidHttpUrl(linkUrl) : true
  const mediaValid = type === "media" ? mediaDrafts.length > 0 : true
  const busy = createPost.isPending || uploading
  const canSubmit = !!community && titleValid && linkValid && mediaValid && !busy

  async function submitMedia() {
    if (!community) return
    setUploading(true)
    try {
      const { data } = await postApiV1Post({
        body: {
          communityId: community.id,
          type: "media",
          title: title.trim(),
          media: mediaDrafts.map((m) => ({
            mediaType: m.mediaType,
            mimeType: m.file.type,
            byteSize: m.file.size,
            width: m.width,
            height: m.height,
          })),
          isNsfw,
          isSpoiler,
          isOc,
          flairTemplateId,
        },
        throwOnError: true,
      })

      const uploads = data.uploads ?? []
      await Promise.all(
        uploads.map(async (upload) => {
          const draft = mediaDrafts[upload.position]
          if (!draft) return
          patchDraft(draft.id, { status: "uploading", progress: 0 })
          try {
            await uploadToPresigned(
              { url: upload.url, fields: upload.fields },
              draft.file,
              (percent) => {
                patchDraft(draft.id, { progress: percent })
              },
            )
            patchDraft(draft.id, { status: "done", progress: 100 })
          } catch (err: unknown) {
            patchDraft(draft.id, { status: "error" })
            throw err
          }
        }),
      )

      await postApiV1MediaConfirm({ body: { postId: data.id }, throwOnError: true })
      clearLoadedDraft()
      void navigate({
        to: "/r/$name/comments/$",
        params: { name: community.name, _splat: data.id },
      })
    } catch {
      toast.error("Could not upload media", {
        description: "One or more files failed to upload. Please try again.",
      })
      setUploading(false)
    }
  }

  function submit() {
    if (!community) return
    if (type === "media") {
      void submitMedia()
      return
    }
    createPost.mutate({
      body: {
        communityId: community.id,
        type,
        title: title.trim(),
        bodyMd: type === "text" ? bodyMd : undefined,
        linkUrl: type === "link" ? linkUrl.trim() : undefined,
        isNsfw,
        isSpoiler,
        isOc,
        flairTemplateId,
      },
    })
  }

  const tagCount = [isNsfw, isSpoiler, isOc].filter(Boolean).length

  function saveDraftNow() {
    saveDraft.mutate({
      body: {
        communityId: community?.id ?? null,
        isProfile: false,
        type,
        title: title.trim() || null,
        bodyMd: type === "text" ? bodyMd : null,
        linkUrl: type === "link" ? linkUrl.trim() : null,
        isNsfw,
        isSpoiler,
        isOc,
        flairTemplateId,
      },
    })
  }

  function buildSchedulePayload() {
    if (!community || !titleValid || type === "media") return null
    return {
      communityId: community.id,
      isProfile: false,
      type,
      title: title.trim(),
      bodyMd: type === "text" ? bodyMd : undefined,
      linkUrl: type === "link" ? linkUrl.trim() : undefined,
      isNsfw,
      isSpoiler,
      isOc,
      flairTemplateId,
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Create post</h1>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setDraftsOpen(true)
          }}
        >
          <FileText className="size-4" />
          Drafts
        </Button>
      </div>

      {fixedCommunity ? (
        <div className="mb-4 flex items-center gap-2 rounded-md border bg-card p-3">
          <CommunityIcon name={fixedCommunity.name} size="md" />
          <div>
            <p className="text-sm font-semibold">
              {fixedCommunity.displayName ?? `r/${fixedCommunity.name}`}
            </p>
            <p className="text-xs text-muted-foreground">r/{fixedCommunity.name}</p>
          </div>
        </div>
      ) : (
        <div className="mb-4">
          <Label className="mb-1.5 block">Community</Label>
          <Select value={pickedId ?? ""} onValueChange={setPickedId}>
            <SelectTrigger className="w-full sm:w-72">
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
      )}

      <Tabs
        value={type}
        onValueChange={(v) => {
          setType(v as PostType)
        }}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="text">
            <Type className="size-4" />
            Text
          </TabsTrigger>
          <TabsTrigger value="link">
            <Link2 className="size-4" />
            Link
          </TabsTrigger>
          <TabsTrigger value="media">
            <Image className="size-4" />
            Media
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-col gap-4">
        <div>
          <div className="relative">
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value.slice(0, TITLE_MAX))
              }}
              placeholder="Title"
              aria-label="Title"
            />
          </div>
          <p className="mt-1 text-right text-xs text-muted-foreground">
            {title.length}/{TITLE_MAX}
          </p>
        </div>

        {type === "text" ? (
          <MarkdownEditor
            value={bodyMd}
            onChange={setBodyMd}
            renderPreview={(md) => <Markdown content={md} />}
          />
        ) : type === "link" ? (
          <div>
            <Input
              type="url"
              value={linkUrl}
              onChange={(e) => {
                setLinkUrl(e.target.value)
              }}
              placeholder="https://example.com"
              aria-label="Link URL"
            />
            {linkUrl && !linkValid ? (
              <p className="mt-1 text-xs text-destructive">Enter a valid http(s) URL.</p>
            ) : null}
          </div>
        ) : (
          <MediaPicker
            drafts={mediaDrafts}
            onAdd={addFiles}
            onRemove={removeDraft}
            disabled={uploading}
          />
        )}

        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger
              render={
                <Button variant="outline" size="sm" type="button">
                  <TagIcon className="size-4" />
                  Add tags{tagCount > 0 ? ` (${tagCount})` : ""}
                </Button>
              }
            />
            <PopoverContent align="start" className="w-64">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="tag-nsfw">NSFW</Label>
                  <Switch id="tag-nsfw" checked={isNsfw} onCheckedChange={setIsNsfw} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="tag-spoiler">Spoiler</Label>
                  <Switch id="tag-spoiler" checked={isSpoiler} onCheckedChange={setIsSpoiler} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="tag-oc">Original Content</Label>
                  <Switch id="tag-oc" checked={isOc} onCheckedChange={setIsOc} />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {community ? (
          <FlairPicker
            communityId={community.id}
            value={flairTemplateId}
            onChange={setFlairTemplateId}
          />
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={saveDraft.isPending || busy}
            onClick={saveDraftNow}
          >
            <Save className="size-4" />
            Save draft
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || type === "media" || !community || !titleValid}
            onClick={() => {
              setScheduleOpen(true)
            }}
          >
            <Clock className="size-4" />
            Schedule
          </Button>
          <LoadingButton loading={busy} disabled={!canSubmit} onClick={submit}>
            Post
          </LoadingButton>
        </div>
      </div>

      <DraftsDialog open={draftsOpen} onOpenChange={setDraftsOpen} onLoad={loadDraft} />
      <ScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        getPayload={buildSchedulePayload}
      />
    </div>
  )
}
