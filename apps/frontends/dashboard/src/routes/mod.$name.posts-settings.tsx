import { createFileRoute } from "@tanstack/react-router"
import { Card, CardContent, CardHeader, CardTitle } from "@ui/base/ui/card"
import { Input } from "@ui/base/ui/input"
import { Label } from "@ui/base/ui/label"
import { LoadingButton } from "@ui/base/ui/loading-button"
import { RadioGroup, RadioGroupItem } from "@ui/base/ui/radio-group"
import { Separator } from "@ui/base/ui/separator"
import { Switch } from "@ui/base/ui/switch"
import { Textarea } from "@ui/base/ui/textarea"
import { FlairManager } from "@frontends/dashboard/components/mod/FlairManager"
import {
  useCommunitySettings,
  type CommunitySettingsBody,
  type CommunityWithSettings,
} from "@frontends/dashboard/components/mod/useCommunitySettings"
import { useEffect, useState } from "react"

export const Route = createFileRoute("/mod/$name/posts-settings")({
  component: PostsSettingsPage,
})

const POST_TYPES = [
  { value: "all", label: "Any (text, links, media)" },
  { value: "text_only", label: "Text posts only" },
  { value: "links_only", label: "Links only" },
] as const

const BODY_POLICIES = [
  { value: "optional", label: "Optional" },
  { value: "required", label: "Required" },
  { value: "none", label: "Not allowed" },
] as const

const TOGGLES = [
  {
    key: "requirePostFlair" as const,
    label: "Require post flair",
    description: "Members must choose a flair when posting.",
  },
  {
    key: "holdForReview" as const,
    label: "Hold new posts for review",
    description: "Send new posts to the mod queue before they appear.",
  },
  {
    key: "spoilerEnabled" as const,
    label: "Enable spoiler tags",
    description: "Let members mark posts as spoilers.",
  },
]

function parseDomains(value: string): string[] | null {
  const list = value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "")
  return list.length === 0 ? null : list
}

function TextGroup({
  community,
  save,
  saving,
}: {
  community: CommunityWithSettings
  save: (body: CommunitySettingsBody) => void
  saving: boolean
}) {
  const [postGuidelines, setPostGuidelines] = useState("")
  const [titleRegex, setTitleRegex] = useState("")
  const [whitelist, setWhitelist] = useState("")
  const [blacklist, setBlacklist] = useState("")

  useEffect(() => {
    setPostGuidelines(community.postGuidelines ?? "")
    setTitleRegex(community.titleRegex ?? "")
    setWhitelist((community.linkDomainWhitelist ?? []).join(", "))
    setBlacklist((community.linkDomainBlacklist ?? []).join(", "))
  }, [community])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Content policy</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="post-guidelines">Post guidelines</Label>
          <Textarea
            id="post-guidelines"
            rows={3}
            value={postGuidelines}
            onChange={(e) => {
              setPostGuidelines(e.target.value)
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title-regex">Title regex</Label>
          <Input
            id="title-regex"
            value={titleRegex}
            placeholder="e.g. ^\[.+\]"
            onChange={(e) => {
              setTitleRegex(e.target.value)
            }}
          />
          <p className="text-xs text-muted-foreground">Post titles must match this pattern.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="domain-whitelist">Allowed link domains</Label>
          <Input
            id="domain-whitelist"
            value={whitelist}
            placeholder="example.com, another.com"
            onChange={(e) => {
              setWhitelist(e.target.value)
            }}
          />
          <p className="text-xs text-muted-foreground">
            Comma-separated. Leave empty to allow all.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="domain-blacklist">Blocked link domains</Label>
          <Input
            id="domain-blacklist"
            value={blacklist}
            placeholder="spam.com"
            onChange={(e) => {
              setBlacklist(e.target.value)
            }}
          />
          <p className="text-xs text-muted-foreground">Comma-separated.</p>
        </div>
        <LoadingButton
          className="w-fit"
          loading={saving}
          onClick={() => {
            save({
              postGuidelines: postGuidelines.trim() === "" ? null : postGuidelines,
              titleRegex: titleRegex.trim() === "" ? null : titleRegex.trim(),
              linkDomainWhitelist: parseDomains(whitelist),
              linkDomainBlacklist: parseDomains(blacklist),
            })
          }}
        >
          Save
        </LoadingButton>
      </CardContent>
    </Card>
  )
}

function PostsSettingsInner({ community }: { community: CommunityWithSettings }) {
  const { save, saving } = useCommunitySettings(community.name)

  return (
    <div className="flex flex-col gap-6">
      <TextGroup community={community} save={save} saving={saving} />

      <Card>
        <CardHeader>
          <CardTitle>Posts &amp; comments</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label>Post types allowed</Label>
            <RadioGroup
              value={community.allowedPostTypes ?? "all"}
              onValueChange={(v) => {
                save({ allowedPostTypes: v as (typeof POST_TYPES)[number]["value"] })
              }}
              className="gap-2"
            >
              {POST_TYPES.map((t) => (
                <Label
                  key={t.value}
                  htmlFor={`post-type-${t.value}`}
                  className="flex items-center gap-2"
                >
                  <RadioGroupItem id={`post-type-${t.value}`} value={t.value} />
                  {t.label}
                </Label>
              ))}
            </RadioGroup>
          </div>
          <Separator />
          <div className="flex flex-col gap-2">
            <Label>Post body</Label>
            <RadioGroup
              value={community.bodyPolicy ?? "optional"}
              onValueChange={(v) => {
                save({ bodyPolicy: v as (typeof BODY_POLICIES)[number]["value"] })
              }}
              className="flex flex-wrap gap-4"
            >
              {BODY_POLICIES.map((b) => (
                <Label
                  key={b.value}
                  htmlFor={`body-${b.value}`}
                  className="flex items-center gap-2"
                >
                  <RadioGroupItem id={`body-${b.value}`} value={b.value} />
                  {b.label}
                </Label>
              ))}
            </RadioGroup>
          </div>
          <Separator />
          {TOGGLES.map((toggle) => (
            <div key={toggle.key} className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <Label htmlFor={`toggle-${toggle.key}`}>{toggle.label}</Label>
                <p className="text-sm text-muted-foreground">{toggle.description}</p>
              </div>
              <Switch
                id={`toggle-${toggle.key}`}
                checked={community[toggle.key]}
                onCheckedChange={(checked) => {
                  save({ [toggle.key]: checked })
                }}
              />
            </div>
          ))}
          <Separator />
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <Label>Media in comments</Label>
              <p className="text-sm text-muted-foreground">Allow images and GIFs in comments.</p>
            </div>
            <Switch checked={community.mediaInComments} disabled />
          </div>
          <p className="-mt-3 text-xs text-muted-foreground">Media in comments is coming soon.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Flair</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <FlairManager communityId={community.id} kind="post" />
          <Separator />
          <FlairManager communityId={community.id} kind="user" />
        </CardContent>
      </Card>
    </div>
  )
}

function PostsSettingsPage() {
  const { name } = Route.useParams()
  const { community, aggregate, isLoading } = useCommunitySettings(name)

  if (aggregate) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Choose a specific community to edit its settings.
      </p>
    )
  }
  if (isLoading || !community) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading...</p>
  }

  return <PostsSettingsInner community={community} />
}
