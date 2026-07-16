import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Button } from "@ui/base/ui/button"
import { cn } from "@ui/base/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@ui/base/ui/dialog"
import { Label } from "@ui/base/ui/label"
import { RadioGroup, RadioGroupItem } from "@ui/base/ui/radio-group"
import { Switch } from "@ui/base/ui/switch"
import { Textarea } from "@ui/base/ui/textarea"
import { CommunityIcon } from "@ui/seo-shared/community/CommunityIcon"
import { visibilityMeta, type CommunityVisibility } from "@ui/seo-shared/community/visibility"
import {
  getApiV1CommunityMemberMineOptions,
  getApiV1CommunityNameAvailableOptions,
  getApiV1TopicOptions,
  postApiV1CommunityMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { Check, Loader2, X } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

const NAME_MAX = 21
const NAME_RE = /^[A-Za-z0-9_]+$/
const VISIBILITIES: CommunityVisibility[] = ["public", "restricted", "private"]

type WizardProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(value)
    }, delay)
    return () => {
      clearTimeout(id)
    }
  }, [value, delay])
  return debounced
}

function NameAvailability({ name, formatValid }: { name: string; formatValid: boolean }) {
  const debounced = useDebounced(name, 400)
  const enabled = formatValid && debounced.length > 0 && debounced === name
  const { data, isFetching } = useQuery({
    ...getApiV1CommunityNameAvailableOptions({ query: { name: debounced } }),
    enabled,
  })

  if (!name) return null
  if (!formatValid) {
    return <p className="text-xs text-destructive">Letters, numbers, and underscores only.</p>
  }
  if (isFetching || debounced !== name) {
    return (
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Checking availability…
      </p>
    )
  }
  if (data?.available) {
    return (
      <p className="flex items-center gap-1 text-xs text-green-600">
        <Check className="size-3" /> r/{name} is available
      </p>
    )
  }
  return (
    <p className="flex items-center gap-1 text-xs text-destructive">
      <X className="size-3" /> r/{name} is taken
    </p>
  )
}

export function CreateCommunityWizard({ open, onOpenChange }: WizardProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [step, setStep] = useState(0)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [topicId, setTopicId] = useState<string | null>(null)
  const [visibility, setVisibility] = useState<CommunityVisibility>("public")
  const [isNsfw, setIsNsfw] = useState(false)

  const { data: topicData } = useQuery({ ...getApiV1TopicOptions(), enabled: open })

  const debouncedName = useDebounced(name, 400)
  const formatValid = NAME_RE.test(name)
  const { data: availability } = useQuery({
    ...getApiV1CommunityNameAvailableOptions({ query: { name: debouncedName } }),
    enabled: open && formatValid && debouncedName.length > 0 && debouncedName === name,
  })

  const createMutation = useMutation({
    ...postApiV1CommunityMutation(),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: getApiV1CommunityMemberMineOptions().queryKey,
      })
      toast.success("Community created", { description: `r/${result.name} is ready.` })
      onOpenChange(false)
      void navigate({ to: "/r/$name", params: { name: result.name } })
    },
    onError: () => {
      toast.error("Could not create community")
    },
  })

  function reset() {
    setStep(0)
    setName("")
    setDescription("")
    setTopicId(null)
    setVisibility("public")
    setIsNsfw(false)
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
    if (!next) reset()
  }

  const nameReady = formatValid && name.length > 0 && availability?.available === true
  const canProceed = step === 0 ? nameReady : step === 1 ? topicId !== null : true

  function handleCreate() {
    createMutation.mutate({
      body: {
        name,
        description,
        visibility,
        isNsfw,
        topicId,
      },
    })
  }

  const topics = topicData?.data ?? []

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === 0
              ? "Tell us about your community"
              : step === 1
                ? "Pick a topic"
                : step === 2
                  ? "Choose visibility"
                  : "Review and create"}
          </DialogTitle>
        </DialogHeader>

        {/* Step dots */}
        <div className="flex justify-center gap-2">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn(
                "size-2 rounded-full transition-colors",
                i === step ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>

        {step === 0 ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="community-name">Community name</Label>
              <div className="flex items-center rounded-md border focus-within:ring-2 focus-within:ring-ring">
                <span className="pl-3 text-sm text-muted-foreground">r/</span>
                <input
                  id="community-name"
                  aria-label="Community name"
                  value={name}
                  maxLength={NAME_MAX}
                  onChange={(e) => {
                    setName(e.target.value.replace(/\s/g, ""))
                  }}
                  className="flex-1 bg-transparent px-1 py-2 text-sm outline-none"
                  placeholder="community_name"
                  autoComplete="off"
                />
                <span className="pr-3 text-xs text-muted-foreground">{NAME_MAX - name.length}</span>
              </div>
              <NameAvailability name={name} formatValid={formatValid} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="community-description">Description</Label>
              <Textarea
                id="community-description"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value)
                }}
                placeholder="What is your community about?"
                rows={4}
              />
            </div>

            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Preview</p>
              <div className="flex items-center gap-3">
                <CommunityIcon name={name || "community"} size="lg" />
                <div className="min-w-0">
                  <p className="truncate font-semibold">r/{name || "community_name"}</p>
                  <p className="text-xs text-muted-foreground">1 member</p>
                </div>
              </div>
              {description ? (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
            {topics.map((topic) => (
              <button
                key={topic.id}
                type="button"
                onClick={() => {
                  setTopicId(topic.id)
                }}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  topicId === topic.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-accent",
                )}
              >
                {topic.name}
              </button>
            ))}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="flex flex-col gap-4">
            <RadioGroup
              value={visibility}
              onValueChange={(v) => {
                setVisibility(v as CommunityVisibility)
              }}
              className="gap-2"
            >
              {VISIBILITIES.map((v) => {
                const meta = visibilityMeta(v)
                const Icon = meta.icon
                return (
                  <Label
                    key={v}
                    htmlFor={`visibility-${v}`}
                    className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-accent"
                  >
                    <RadioGroupItem id={`visibility-${v}`} value={v} className="mt-0.5" />
                    <Icon className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{meta.label}</p>
                      <p className="text-xs text-muted-foreground">{meta.description}</p>
                    </div>
                  </Label>
                )
              })}
            </RadioGroup>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Mature (18+)</p>
                <p className="text-xs text-muted-foreground">
                  Content is NSFW and restricted to adults.
                </p>
              </div>
              <Switch checked={isNsfw} onCheckedChange={setIsNsfw} />
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <CommunityIcon name={name} size="lg" />
              <div className="min-w-0">
                <p className="truncate font-semibold">r/{name}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {visibilityMeta(visibility).label}
                  {isNsfw ? " · NSFW" : ""}
                </p>
              </div>
            </div>
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
            <dl className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Topic</dt>
                <dd>{topics.find((t) => t.id === topicId)?.name ?? "—"}</dd>
              </div>
            </dl>
          </div>
        ) : null}

        {/* Footer */}
        <div className="mt-2 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => {
              if (step === 0) handleOpenChange(false)
              else setStep((s) => s - 1)
            }}
            disabled={createMutation.isPending}
          >
            {step === 0 ? "Cancel" : "Back"}
          </Button>
          {step < 3 ? (
            <Button
              onClick={() => {
                setStep((s) => s + 1)
              }}
              disabled={!canProceed}
            >
              Next
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={createMutation.isPending || !nameReady}>
              {createMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Create Community
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
