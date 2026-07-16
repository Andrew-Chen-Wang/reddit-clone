import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Button } from "@ui/base/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@ui/base/ui/dialog"
import { Input } from "@ui/base/ui/input"
import { Label } from "@ui/base/ui/label"
import { LoadingButton } from "@ui/base/ui/loading-button"
import { Textarea } from "@ui/base/ui/textarea"
import { useModCommunity } from "@frontends/dashboard/components/mod/useModCommunity"
import {
  deleteApiV1ModSavedResponseResponseByIdMutation,
  getApiV1ModSavedResponseByCommunityIdOptions,
  patchApiV1ModSavedResponseResponseByIdMutation,
  postApiV1ModSavedResponseByCommunityIdMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

export const Route = createFileRoute("/mod/$name/saved-responses")({
  component: SavedResponsesPage,
})

type SavedResponse = { id: string; title: string; bodyMd: string }

function ResponseDialog({
  open,
  onOpenChange,
  heading,
  initial,
  saving,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  heading: string
  initial: { title: string; bodyMd: string }
  saving: boolean
  onSubmit: (values: { title: string; bodyMd: string }) => void
}) {
  const [title, setTitle] = useState(initial.title)
  const [bodyMd, setBodyMd] = useState(initial.bodyMd)

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setTitle(initial.title)
          setBodyMd(initial.bodyMd)
        }
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="response-title">Title</Label>
            <Input
              id="response-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="response-body">Message (Markdown)</Label>
            <Textarea
              id="response-body"
              rows={6}
              value={bodyMd}
              onChange={(e) => {
                setBodyMd(e.target.value)
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <LoadingButton
            loading={saving}
            disabled={title.trim() === "" || bodyMd.trim() === ""}
            onClick={() => {
              onSubmit({ title: title.trim(), bodyMd: bodyMd.trim() })
            }}
          >
            Save
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SavedResponsesInner({ communityId }: { communityId: string }) {
  const queryClient = useQueryClient()
  const options = getApiV1ModSavedResponseByCommunityIdOptions({ path: { communityId } })
  const { data } = useQuery(options)
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: options.queryKey })
  }
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<SavedResponse | null>(null)

  const create = useMutation({
    ...postApiV1ModSavedResponseByCommunityIdMutation(),
    onSuccess: () => {
      toast.success("Saved response created")
      setCreateOpen(false)
      invalidate()
    },
    onError: () => {
      toast.error("Could not create saved response")
    },
  })
  const update = useMutation({
    ...patchApiV1ModSavedResponseResponseByIdMutation(),
    onSuccess: () => {
      toast.success("Saved response updated")
      setEditing(null)
      invalidate()
    },
    onError: () => {
      toast.error("Could not update saved response")
    },
  })
  const remove = useMutation({
    ...deleteApiV1ModSavedResponseResponseByIdMutation(),
    onSuccess: invalidate,
    onError: () => {
      toast.error("Could not delete saved response")
    },
  })

  const responses = data?.data ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Saved Responses</h2>
        <Button
          size="sm"
          onClick={() => {
            setCreateOpen(true)
          }}
        >
          <Plus className="size-4" />
          New response
        </Button>
      </div>
      {responses.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No saved responses yet. Create reusable replies for common moderation situations.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {responses.map((response) => (
            <div key={response.id} className="flex items-start gap-2 rounded-md border p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{response.title}</p>
                <p className="line-clamp-2 text-sm text-muted-foreground">{response.bodyMd}</p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Edit response"
                onClick={() => {
                  setEditing(response)
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Delete response"
                onClick={() => {
                  remove.mutate({ path: { id: response.id } })
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <ResponseDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        heading="New saved response"
        initial={{ title: "", bodyMd: "" }}
        saving={create.isPending}
        onSubmit={(values) => {
          create.mutate({ path: { communityId }, body: values })
        }}
      />
      {editing ? (
        <ResponseDialog
          open
          onOpenChange={(o) => {
            if (!o) setEditing(null)
          }}
          heading="Edit saved response"
          initial={{ title: editing.title, bodyMd: editing.bodyMd }}
          saving={update.isPending}
          onSubmit={(values) => {
            update.mutate({ path: { id: editing.id }, body: values })
          }}
        />
      ) : null}
    </div>
  )
}

function SavedResponsesPage() {
  const { name } = Route.useParams()
  const { communityId, aggregate, isLoading } = useModCommunity(name)

  if (aggregate) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Choose a specific community to manage saved responses.
      </p>
    )
  }
  if (isLoading || !communityId) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading...</p>
  }

  return <SavedResponsesInner communityId={communityId} />
}
