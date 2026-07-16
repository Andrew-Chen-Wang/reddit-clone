import { createFileRoute } from "@tanstack/react-router"
import { Card, CardContent, CardHeader, CardTitle } from "@ui/base/ui/card"
import { Label } from "@ui/base/ui/label"
import { Separator } from "@ui/base/ui/separator"
import { Switch } from "@ui/base/ui/switch"
import { useCommunitySettings } from "@frontends/dashboard/components/mod/useCommunitySettings"

export const Route = createFileRoute("/mod/$name/notifications")({
  component: NotificationsSettingsPage,
})

const TOGGLES = [
  {
    key: "notifyActivity" as const,
    label: "Activity",
    description: "Notify moderators about notable community activity.",
  },
  {
    key: "notifyReports" as const,
    label: "Reports",
    description: "Notify moderators when content is reported.",
  },
  {
    key: "notifyMilestones" as const,
    label: "Milestones",
    description: "Notify moderators about growth milestones.",
  },
]

function NotificationsSettingsPage() {
  const { name } = Route.useParams()
  const { community, aggregate, isLoading, save } = useCommunitySettings(name)

  if (aggregate) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Choose a specific community to edit its notifications.
      </p>
    )
  }
  if (isLoading || !community) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading...</p>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
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
  )
}
