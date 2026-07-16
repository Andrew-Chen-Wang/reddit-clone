import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Card, CardContent, CardHeader, CardTitle } from "@ui/base/ui/card"
import { Input } from "@ui/base/ui/input"
import { Label } from "@ui/base/ui/label"
import { LoadingButton } from "@ui/base/ui/loading-button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/base/ui/select"
import { Separator } from "@ui/base/ui/separator"
import { Switch } from "@ui/base/ui/switch"
import { Textarea } from "@ui/base/ui/textarea"
import {
  useCommunitySettings,
  type CommunityWithSettings,
} from "@frontends/dashboard/components/mod/useCommunitySettings"
import { getApiV1TopicOptions } from "@lib/api-client/generated/@tanstack/react-query.gen"
import { useEffect, useState } from "react"

export const Route = createFileRoute("/mod/$name/settings")({
  component: GeneralSettingsPage,
})

const COMMENT_SORTS = [
  { value: "best", label: "Best" },
  { value: "top", label: "Top" },
  { value: "new", label: "New" },
  { value: "controversial", label: "Controversial" },
  { value: "old", label: "Old" },
] as const

const TOGGLES = [
  {
    key: "isNsfw" as const,
    label: "Mature (18+)",
    description: "Mark this community as containing mature content.",
  },
  {
    key: "archiveOldPosts" as const,
    label: "Archive old posts",
    description: "Automatically lock posts after six months.",
  },
  {
    key: "appearInFeeds" as const,
    label: "Appear in ReadIt feeds",
    description: "Allow posts to surface in r/all and r/popular.",
  },
  {
    key: "appearInRecommendations" as const,
    label: "Appear in recommendations",
    description: "Let ReadIt recommend this community to others.",
  },
]

function TextGroup({
  community,
  save,
  saving,
}: {
  community: CommunityWithSettings
  save: ReturnType<typeof useCommunitySettings>["save"]
  saving: boolean
}) {
  const [displayName, setDisplayName] = useState("")
  const [description, setDescription] = useState("")
  const [welcomeMessage, setWelcomeMessage] = useState("")

  useEffect(() => {
    setDisplayName(community.displayName ?? "")
    setDescription(community.description ?? "")
    setWelcomeMessage(community.welcomeMessage ?? "")
  }, [community])

  return (
    <Card>
      <CardHeader>
        <CardTitle>General</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="community-display-name">Display name</Label>
          <Input
            id="community-display-name"
            value={displayName}
            maxLength={100}
            onChange={(e) => {
              setDisplayName(e.target.value)
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="community-description">Description</Label>
          <Textarea
            id="community-description"
            rows={3}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="community-welcome">Welcome message</Label>
          <Textarea
            id="community-welcome"
            rows={3}
            value={welcomeMessage}
            placeholder="Shown to new members when they join."
            onChange={(e) => {
              setWelcomeMessage(e.target.value)
            }}
          />
        </div>
        <LoadingButton
          className="w-fit"
          loading={saving}
          onClick={() => {
            save({
              displayName: displayName.trim() === "" ? null : displayName.trim(),
              description,
              welcomeMessage: welcomeMessage.trim() === "" ? null : welcomeMessage.trim(),
            })
          }}
        >
          Save
        </LoadingButton>
      </CardContent>
    </Card>
  )
}

function GeneralSettingsInner({ community }: { community: CommunityWithSettings }) {
  const { save, saving } = useCommunitySettings(community.name)
  const { data: topicData } = useQuery(getApiV1TopicOptions())
  const topics = topicData?.data ?? []

  return (
    <div className="flex flex-col gap-6">
      <TextGroup community={community} save={save} saving={saving} />

      <Card>
        <CardHeader>
          <CardTitle>Community</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label>Topic</Label>
              <p className="text-sm text-muted-foreground">Primary topic for discovery.</p>
            </div>
            <Select
              items={Object.fromEntries(topics.map((t) => [t.id, t.name]))}
              value={community.topicId ?? ""}
              onValueChange={(v) => {
                save({ topicId: v })
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Pick a topic" />
              </SelectTrigger>
              <SelectContent>
                {topics.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label>Default comment sort</Label>
              <p className="text-sm text-muted-foreground">How comments are ordered by default.</p>
            </div>
            <Select
              items={Object.fromEntries(COMMENT_SORTS.map((s) => [s.value, s.label]))}
              value={community.defaultCommentSort}
              onValueChange={(v) => {
                const match = COMMENT_SORTS.find((s) => s.value === v)
                if (match) save({ defaultCommentSort: match.value })
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMENT_SORTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Discovery &amp; content</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {TOGGLES.map((toggle, index) => (
            <div key={toggle.key}>
              {index > 0 ? <Separator className="my-1" /> : null}
              <div className="flex items-center justify-between gap-4 py-2">
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
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function GeneralSettingsPage() {
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

  return <GeneralSettingsInner community={community} />
}
