import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@ui/base/ui/alert-dialog"
import { buttonVariants } from "@ui/base/ui/button"
import { cn } from "@ui/base/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@ui/base/ui/card"
import { Input } from "@ui/base/ui/input"
import { Label } from "@ui/base/ui/label"
import { LoadingButton } from "@ui/base/ui/loading-button"
import { RadioGroup, RadioGroupItem } from "@ui/base/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/base/ui/select"
import { Separator } from "@ui/base/ui/separator"
import { Switch } from "@ui/base/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ui/base/ui/tabs"
import { Textarea } from "@ui/base/ui/textarea"
import { useTheme, type Theme } from "@ui/spa-shared/theme"
import { formatCompactNumber } from "@ui/seo-shared/format-number"
import {
  deleteApiV1UserMeDeleteMutation,
  getApiV1UserMeOptions,
  getApiV1UserMeSettingsOptions,
  patchApiV1UserMeMutation,
  patchApiV1UserMeSettingsMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import type { PatchApiV1UserMeSettingsData } from "@lib/api-client/generated/types.gen"
import { useEffect, useState } from "react"
import { toast } from "sonner"

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
})

type SettingsBody = NonNullable<PatchApiV1UserMeSettingsData["body"]>
type DisplayMode = "auto" | "light" | "dark"

const THEME_FROM_MODE: Record<DisplayMode, Theme> = {
  auto: "system",
  light: "light",
  dark: "dark",
}

const DISPLAY_MODES: { value: DisplayMode; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
]

const TOGGLES: { key: keyof SettingsBody; label: string; description: string }[] = [
  {
    key: "defaultMarkdownEditor",
    label: "Default to Markdown editor",
    description: "Open the Markdown editor when creating posts and comments.",
  },
  {
    key: "showMature",
    label: "Show mature (18+) content",
    description: "Allow mature content to appear in your feeds.",
  },
  {
    key: "blurMature",
    label: "Blur mature content",
    description: "Blur thumbnails and media marked as mature.",
  },
  {
    key: "allowFollows",
    label: "Allow people to follow you",
    description: "Let other people follow your profile.",
  },
  {
    key: "showInSearch",
    label: "Show up in search results",
    description: "Allow your profile to appear in search.",
  },
  {
    key: "showRecommendations",
    label: "Show recommendations",
    description: "Show recommended communities and posts in your feeds.",
  },
  {
    key: "autoplayMedia",
    label: "Autoplay media",
    description: "Automatically play videos and GIFs.",
  },
  {
    key: "reduceMotion",
    label: "Reduce motion",
    description: "Minimize non-essential animations.",
  },
  {
    key: "openPostsNewTab",
    label: "Open posts in new tab",
    description: "Open posts in a new browser tab.",
  },
  {
    key: "safeSearch",
    label: "Safe search",
    description: "Filter explicit results from search.",
  },
  {
    key: "showFollowerCount",
    label: "Show follower count",
    description: "Display your follower count on your profile.",
  },
]

const CHAT_POLICIES: { value: NonNullable<SettingsBody["chatRequestPolicy"]>; label: string }[] = [
  { value: "everyone", label: "Everyone" },
  { value: "accounts_30d", label: "Accounts older than 30 days" },
  { value: "nobody", label: "Nobody" },
]

function AccountTab() {
  const { data: user } = useQuery(getApiV1UserMeOptions())
  const deleteMutation = useMutation({
    ...deleteApiV1UserMeDeleteMutation(),
    onSuccess: () => {
      window.location.href = `${import.meta.env.VITE_NEXTJS_URL ?? ""}/`
    },
    onError: () => {
      toast.error("Could not delete your account")
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="account-email">Email</Label>
            <Input id="account-email" value={user?.email ?? ""} readOnly disabled />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Karma</Label>
            <p className="text-sm text-muted-foreground">
              {formatCompactNumber(user?.postKarma ?? 0)} post ·{" "}
              {formatCompactNumber(user?.commentKarma ?? 0)} comment
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Delete account</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Permanently delete your account and all of its data. This cannot be undone.
          </p>
          <AlertDialog>
            <AlertDialogTrigger className={cn(buttonVariants({ variant: "destructive" }), "w-fit")}>
              Delete account
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes your account and all of its data. This action cannot be
                  undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={deleteMutation.isPending}
                  onClick={(event) => {
                    event.preventDefault()
                    void deleteMutation.mutateAsync({})
                  }}
                >
                  Delete account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  )
}

function ProfileTab() {
  const queryClient = useQueryClient()
  const { data: user } = useQuery(getApiV1UserMeOptions())
  const [displayName, setDisplayName] = useState("")
  const [about, setAbout] = useState("")

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName ?? "")
      setAbout(user.about ?? "")
    }
  }, [user])

  const mutation = useMutation({
    ...patchApiV1UserMeMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: getApiV1UserMeOptions().queryKey })
      toast.success("Profile saved")
    },
    onError: () => {
      toast.error("Could not save your profile")
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="display-name">Display name</Label>
          <Input
            id="display-name"
            value={displayName}
            maxLength={30}
            placeholder={user?.username ?? ""}
            onChange={(event) => {
              setDisplayName(event.target.value)
            }}
          />
          <p className="text-xs text-muted-foreground">{displayName.length}/30</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="about">About</Label>
          <Textarea
            id="about"
            value={about}
            maxLength={200}
            rows={4}
            onChange={(event) => {
              setAbout(event.target.value)
            }}
          />
          <p className="text-xs text-muted-foreground">{about.length}/200</p>
        </div>
        <LoadingButton
          type="button"
          className="w-fit"
          loading={mutation.isPending}
          onClick={() => {
            mutation.mutate({
              body: { displayName: displayName || null, about: about || null },
            })
          }}
        >
          Save
        </LoadingButton>
      </CardContent>
    </Card>
  )
}

function PreferencesTab() {
  const queryClient = useQueryClient()
  const { setTheme } = useTheme()
  const { data: settings } = useQuery(getApiV1UserMeSettingsOptions())

  const mutation = useMutation({
    ...patchApiV1UserMeSettingsMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: getApiV1UserMeSettingsOptions().queryKey })
    },
    onError: () => {
      toast.error("Could not save your preference")
    },
  })

  const save = (body: SettingsBody) => {
    mutation.mutate({ body })
  }

  const displayMode = (settings?.displayMode as DisplayMode | undefined) ?? "auto"

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <Label>Display mode</Label>
            <RadioGroup
              value={displayMode}
              className="flex flex-wrap gap-4"
              onValueChange={(next) => {
                const mode = next as DisplayMode
                setTheme(THEME_FROM_MODE[mode])
                save({ displayMode: mode })
              }}
            >
              {DISPLAY_MODES.map(({ value, label }) => (
                <Label
                  key={value}
                  htmlFor={`mode-${value}`}
                  className="flex cursor-pointer items-center gap-2"
                >
                  <RadioGroupItem id={`mode-${value}`} value={value} />
                  {label}
                </Label>
              ))}
            </RadioGroup>
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label>Feed view</Label>
              <p className="text-sm text-muted-foreground">How posts are displayed in feeds.</p>
            </div>
            <Select
              value={settings?.feedView ?? "card"}
              onValueChange={(next) => {
                save({ feedView: next as NonNullable<SettingsBody["feedView"]> })
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="compact">Compact</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
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
                  checked={Boolean(settings?.[toggle.key])}
                  onCheckedChange={(checked) => {
                    save({ [toggle.key]: checked })
                  }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chat</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label>Who can send you chat requests</Label>
              <p className="text-sm text-muted-foreground">Control who can message you.</p>
            </div>
            <Select
              value={settings?.chatRequestPolicy ?? "everyone"}
              onValueChange={(next) => {
                save({
                  chatRequestPolicy: next as NonNullable<SettingsBody["chatRequestPolicy"]>,
                })
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHAT_POLICIES.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>
      <Tabs defaultValue="account">
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>
        <TabsContent value="account" className="mt-6">
          <AccountTab />
        </TabsContent>
        <TabsContent value="profile" className="mt-6">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="preferences" className="mt-6">
          <PreferencesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
