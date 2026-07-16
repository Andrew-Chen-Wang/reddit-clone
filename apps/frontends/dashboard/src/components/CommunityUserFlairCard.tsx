import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState, type CSSProperties } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@ui/base/ui/avatar"
import { Button } from "@ui/base/ui/button"
import { Card, CardContent } from "@ui/base/ui/card"
import { cn } from "@ui/base/lib/utils"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@ui/base/ui/dialog"
import {
  getApiV1FlairByCommunityIdUserTemplatesOptions,
  getApiV1UserMeOptions,
  putApiV1FlairByCommunityIdMyFlairMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { mediaUrl } from "@frontends/dashboard/lib/mediaUrl"
import { Pencil } from "lucide-react"
import { toast } from "sonner"

type FlairTemplate = {
  id: string
  text: string
  bgColor: string | null
  textColor: string | null
  selfAssignable: boolean
}

export type CommunityUserFlairCardProps = {
  communityId: string
  /** The viewer's current flair in this community (from GET /v1/community/:name viewer.userFlair). */
  currentFlair?: {
    templateId: string | null
    text: string
    bgColor: string | null
    textColor: string | null
  } | null
}

function flairStyle(template: {
  bgColor: string | null
  textColor: string | null
}): CSSProperties | undefined {
  if (!template.bgColor && !template.textColor) return undefined
  return {
    backgroundColor: template.bgColor ?? undefined,
    color: template.textColor ?? undefined,
  }
}

function FlairPill({
  template,
}: {
  template: { text: string; bgColor: string | null; textColor: string | null }
}) {
  const hasColor = Boolean(template.bgColor) || Boolean(template.textColor)
  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full items-center truncate rounded-full px-3 text-xs font-medium",
        !hasColor && "bg-secondary text-secondary-foreground",
      )}
      style={flairStyle(template)}
    >
      {template.text}
    </span>
  )
}

/**
 * "USER FLAIR" rail card: shows the viewer's flair in this community with an edit
 * button that opens a picker of self-assignable user-flair templates. Self-hides when
 * the community has no self-assignable flair and the viewer has none set.
 */
export function CommunityUserFlairCard({
  communityId,
  currentFlair = null,
}: CommunityUserFlairCardProps) {
  const queryClient = useQueryClient()
  const templatesOptions = getApiV1FlairByCommunityIdUserTemplatesOptions({
    path: { communityId },
  })
  const templatesQuery = useQuery(templatesOptions)
  const { data: me } = useQuery(getApiV1UserMeOptions())

  const templates = ((templatesQuery.data?.data ?? []) as FlairTemplate[]).filter(
    (t) => t.selfAssignable,
  )

  const [open, setOpen] = useState(false)
  // Selected template while the picker is open; seeded from the current flair.
  const [selectedId, setSelectedId] = useState<string | null>(currentFlair?.templateId ?? null)
  // Optimistic local view of the applied flair (until the backend exposes current flair).
  const [applied, setApplied] = useState<{
    text: string
    bgColor: string | null
    textColor: string | null
  } | null>(
    currentFlair
      ? {
          text: currentFlair.text,
          bgColor: currentFlair.bgColor,
          textColor: currentFlair.textColor,
        }
      : null,
  )

  const setFlair = useMutation(putApiV1FlairByCommunityIdMyFlairMutation())

  // Nothing to assign and nothing set: don't render the card at all.
  if (templates.length === 0 && !applied) return null

  const initial = (me?.displayName ?? me?.username ?? "?").charAt(0).toUpperCase()

  function apply() {
    const template = templates.find((t) => t.id === selectedId) ?? null
    setFlair.mutate(
      { path: { communityId }, body: { userFlairTemplateId: selectedId } },
      {
        onSuccess: () => {
          setApplied(
            template
              ? { text: template.text, bgColor: template.bgColor, textColor: template.textColor }
              : null,
          )
          setOpen(false)
          void queryClient.invalidateQueries({ queryKey: templatesOptions.queryKey })
          toast.success(template ? "Flair updated" : "Flair removed")
        },
        onError: () => {
          toast.error("Could not update flair")
        },
      },
    )
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            User flair
          </h2>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Edit your flair"
            onClick={() => {
              setSelectedId(currentFlair?.templateId ?? null)
              setOpen(true)
            }}
          >
            <Pencil className="size-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Avatar className="size-8">
            {me?.avatarImageKey ? (
              <AvatarImage src={mediaUrl(me.avatarImageKey) ?? undefined} alt="" />
            ) : null}
            <AvatarFallback className="text-xs">{initial}</AvatarFallback>
          </Avatar>
          {applied ? (
            <FlairPill template={applied} />
          ) : (
            <span className="text-sm text-muted-foreground">Add flair</span>
          )}
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>User flair</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedId(null)
              }}
              className={cn(
                "inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium transition-colors hover:bg-muted",
                selectedId === null && "ring-2 ring-ring ring-offset-2 ring-offset-background",
              )}
            >
              None
            </button>
            {templates.map((template) => {
              const hasColor = Boolean(template.bgColor) || Boolean(template.textColor)
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(template.id)
                  }}
                  className={cn(
                    "inline-flex h-7 max-w-full items-center truncate rounded-full px-3 text-xs font-medium transition-colors",
                    !hasColor && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                    hasColor && "hover:opacity-90",
                    selectedId === template.id &&
                      "ring-2 ring-ring ring-offset-2 ring-offset-background",
                  )}
                  style={flairStyle(template)}
                >
                  {template.text}
                </button>
              )
            })}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false)
              }}
            >
              Cancel
            </Button>
            <Button onClick={apply} disabled={setFlair.isPending}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
