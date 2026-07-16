import { useMutation, useQuery } from "@tanstack/react-query"
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
import { RadioGroup, RadioGroupItem } from "@ui/base/ui/radio-group"
import { Textarea } from "@ui/base/ui/textarea"
import {
  getApiV1CommunityRuleByCommunityIdOptions,
  postApiV1ReportCommentByCommentIdMutation,
  postApiV1ReportPostByPostIdMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { useState } from "react"
import { toast } from "sonner"

export type ReportTarget = { type: "post" | "comment"; id: string }

export type ReportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  communityId: string
  target: ReportTarget
}

const OTHER = "__other__"

/**
 * Report flow for a post or comment: pick a community rule (or "Something else")
 * and optionally add free text. Standalone so any menu can open it by controlling
 * `open`/`onOpenChange` and passing the target.
 */
export function ReportDialog({ open, onOpenChange, communityId, target }: ReportDialogProps) {
  const [ruleId, setRuleId] = useState<string>(OTHER)
  const [reasonText, setReasonText] = useState("")

  const { data: rulesData } = useQuery({
    ...getApiV1CommunityRuleByCommunityIdOptions({ path: { communityId } }),
    enabled: open,
  })
  const rules = rulesData?.data ?? []

  const reportPost = useMutation(postApiV1ReportPostByPostIdMutation())
  const reportComment = useMutation(postApiV1ReportCommentByCommentIdMutation())
  const pending = reportPost.isPending || reportComment.isPending

  function submit() {
    const body = {
      communityRuleId: ruleId === OTHER ? null : ruleId,
      reasonText: reasonText.trim() === "" ? null : reasonText.trim(),
    }
    const opts = {
      onSuccess: () => {
        toast.success("Thanks for reporting", {
          description: "Our moderators will take a look.",
        })
        setReasonText("")
        setRuleId(OTHER)
        onOpenChange(false)
      },
      onError: () => {
        toast.error("Could not submit report")
      },
    }
    if (target.type === "post") {
      reportPost.mutate({ path: { postId: target.id }, body }, opts)
    } else {
      reportComment.mutate({ path: { commentId: target.id }, body }, opts)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report {target.type}</DialogTitle>
          <DialogDescription>
            Tell us what&apos;s wrong with this {target.type}. Reports are anonymous to other users.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup
          value={ruleId}
          onValueChange={setRuleId}
          className="max-h-72 gap-1 overflow-y-auto"
        >
          {rules.map((rule) => (
            <Label
              key={rule.id}
              htmlFor={`report-rule-${rule.id}`}
              className="flex cursor-pointer items-start gap-2 rounded-md border p-2.5 hover:bg-accent"
            >
              <RadioGroupItem id={`report-rule-${rule.id}`} value={rule.id} className="mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{rule.name}</p>
                {rule.description ? (
                  <p className="text-xs text-muted-foreground">{rule.description}</p>
                ) : null}
              </div>
            </Label>
          ))}
          <Label
            htmlFor="report-rule-other"
            className="flex cursor-pointer items-center gap-2 rounded-md border p-2.5 hover:bg-accent"
          >
            <RadioGroupItem id="report-rule-other" value={OTHER} />
            <span className="text-sm font-medium">Something else</span>
          </Label>
        </RadioGroup>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="report-reason">Additional details (optional)</Label>
          <Textarea
            id="report-reason"
            rows={3}
            maxLength={500}
            value={reasonText}
            placeholder="Add any context that will help moderators."
            onChange={(e) => {
              setReasonText(e.target.value)
            }}
          />
        </div>
        <DialogFooter>
          <LoadingButton loading={pending} onClick={submit}>
            Submit report
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
