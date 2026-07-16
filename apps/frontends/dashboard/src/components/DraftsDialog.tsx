import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@ui/base/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@ui/base/ui/dialog"
import { Skeleton } from "@ui/base/ui/skeleton"
import { RelativeTime } from "@ui/seo-shared/RelativeTime"
import {
  getApiV1DraftOptions,
  deleteApiV1DraftByIdMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import type { GetApiV1DraftResponse } from "@lib/api-client/generated/types.gen"
import { FileText, Trash2 } from "lucide-react"
import { toast } from "sonner"

export type DraftItem = GetApiV1DraftResponse["data"][number]

export type DraftsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLoad: (draft: DraftItem) => void
}

/** Lists the user's saved drafts; a row loads its draft into the submit form or deletes it. */
export function DraftsDialog({ open, onOpenChange, onLoad }: DraftsDialogProps) {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ ...getApiV1DraftOptions(), enabled: open })

  const deleteMutation = useMutation({
    ...deleteApiV1DraftByIdMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: getApiV1DraftOptions().queryKey })
    },
    onError: () => {
      toast.error("Could not delete draft")
    },
  })

  const drafts = data?.data ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Drafts</DialogTitle>
          <DialogDescription>
            {data ? `${data.count}/${data.max} drafts saved.` : "Your saved drafts."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-md" />
            ))}
          </div>
        ) : drafts.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            You don't have any saved drafts.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {drafts.map((draft) => (
              <li key={draft.id} className="flex items-center gap-2 rounded-md border p-2">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  onClick={() => {
                    onLoad(draft)
                    onOpenChange(false)
                  }}
                >
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {draft.title ?? "Untitled draft"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {draft.isProfile
                        ? "Profile post"
                        : draft.communityId
                          ? "Community post"
                          : "No community"}{" "}
                      · edited <RelativeTime date={draft.updatedAt} />
                    </p>
                  </div>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete draft"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    deleteMutation.mutate({ path: { id: draft.id } })
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
