import { useMutation, useQuery } from "@tanstack/react-query"
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
  getApiV1FlairByCommunityIdPostTemplatesOptions,
  postApiV1PostMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { Image, Link2, TagIcon, Type } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

const TITLE_MAX = 300

type PostType = "text" | "link"

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

  const createPost = useMutation({
    ...postApiV1PostMutation(),
    onSuccess: (result) => {
      if (community) {
        void navigate({
          to: "/r/$name/comments/$postId",
          params: { name: community.name, postId: result.id },
        })
      }
    },
    onError: () => {
      toast.error("Could not create post")
    },
  })

  const titleValid = title.trim().length > 0 && title.length <= TITLE_MAX
  const linkValid = type === "link" ? isValidHttpUrl(linkUrl) : true
  const canSubmit = !!community && titleValid && linkValid && !createPost.isPending

  function submit() {
    if (!community) return
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

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold">Create post</h1>

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
          <TabsTrigger value="media" disabled>
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
        ) : (
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

        <div className="flex justify-end">
          <LoadingButton loading={createPost.isPending} disabled={!canSubmit} onClick={submit}>
            Post
          </LoadingButton>
        </div>
      </div>
    </div>
  )
}
