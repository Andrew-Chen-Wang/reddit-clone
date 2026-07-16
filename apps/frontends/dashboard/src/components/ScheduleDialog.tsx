import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ui/base/ui/dialog"
import { Input } from "@ui/base/ui/input"
import { Label } from "@ui/base/ui/label"
import { LoadingButton } from "@ui/base/ui/loading-button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/base/ui/select"
import { postApiV1ScheduledPostMutation } from "@lib/api-client/generated/@tanstack/react-query.gen"
import type { PostApiV1ScheduledPostData } from "@lib/api-client/generated/types.gen"
import { useState } from "react"
import { toast } from "sonner"

type Recurrence = "none" | "daily" | "weekly" | "monthly"

/** Post fields to schedule, minus the timing which this dialog collects. */
export type SchedulePayload = Omit<
  NonNullable<PostApiV1ScheduledPostData["body"]>,
  "scheduledAt" | "recurrence"
>

export type ScheduleDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Returns the current post fields, or null if the form isn't valid to schedule. */
  getPayload: () => SchedulePayload | null
}

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6

/** Local datetime string (yyyy-MM-ddThh:mm) one hour from now for the default value. */
function defaultLocalDateTime(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000)
  const offset = d.getTimezoneOffset() * 60 * 1000
  return new Date(d.getTime() - offset).toISOString().slice(0, 16)
}

export function ScheduleDialog({ open, onOpenChange, getPayload }: ScheduleDialogProps) {
  const navigate = useNavigate()
  const [scheduledAt, setScheduledAt] = useState(defaultLocalDateTime)
  const [recurrence, setRecurrence] = useState<Recurrence>("none")

  const mutation = useMutation({
    ...postApiV1ScheduledPostMutation(),
    onSuccess: () => {
      toast.success("Post scheduled")
      onOpenChange(false)
      void navigate({ to: "/" })
    },
    onError: () => {
      toast.error("Could not schedule post")
    },
  })

  function submit() {
    const payload = getPayload()
    if (!payload) {
      toast.error("Add a title and community before scheduling.")
      return
    }
    const when = new Date(scheduledAt)
    const now = Date.now()
    if (Number.isNaN(when.getTime()) || when.getTime() <= now) {
      toast.error("Choose a time in the future.")
      return
    }
    if (when.getTime() - now > SIX_MONTHS_MS) {
      toast.error("Scheduled time must be within 6 months.")
      return
    }
    mutation.mutate({
      body: {
        ...payload,
        scheduledAt: when,
        recurrence: recurrence === "none" ? null : recurrence,
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule post</DialogTitle>
          <DialogDescription>Publish this post automatically at a future time.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="schedule-at">Date and time</Label>
            <Input
              id="schedule-at"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => {
                setScheduledAt(e.target.value)
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Repeat</Label>
            <Select
              value={recurrence}
              onValueChange={(v) => {
                if (v) setRecurrence(v)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <LoadingButton loading={mutation.isPending} onClick={submit}>
            Schedule
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
