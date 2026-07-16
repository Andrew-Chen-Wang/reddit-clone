import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Badge } from "@ui/base/ui/badge"
import { Button } from "@ui/base/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@ui/base/ui/dialog"
import { Input } from "@ui/base/ui/input"
import { Label } from "@ui/base/ui/label"
import { LoadingButton } from "@ui/base/ui/loading-button"
import { Switch } from "@ui/base/ui/switch"
import {
  deleteApiV1FlairPostTemplatesByIdMutation,
  deleteApiV1FlairUserTemplatesByIdMutation,
  getApiV1FlairByCommunityIdPostTemplatesOptions,
  getApiV1FlairByCommunityIdUserTemplatesOptions,
  patchApiV1FlairPostTemplatesByIdMutation,
  patchApiV1FlairUserTemplatesByIdMutation,
  postApiV1FlairByCommunityIdPostTemplatesMutation,
  postApiV1FlairByCommunityIdUserTemplatesMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

type FlairKind = "post" | "user"

type FlairTemplate = {
  id: string
  text: string
  bgColor: string | null
  textColor: string | null
  modOnly: boolean
  selfAssignable?: boolean
}

type FlairDraft = {
  text: string
  bgColor: string
  textColor: string
  modOnly: boolean
  selfAssignable: boolean
}

function FlairPreview({
  template,
}: {
  template: { text: string; bgColor: string; textColor: string }
}) {
  return (
    <Badge
      variant="secondary"
      style={{ backgroundColor: template.bgColor, color: template.textColor }}
    >
      {template.text === "" ? "Flair" : template.text}
    </Badge>
  )
}

function FlairDialog({
  open,
  onOpenChange,
  kind,
  heading,
  initial,
  saving,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  kind: FlairKind
  heading: string
  initial: FlairDraft
  saving: boolean
  onSubmit: (draft: FlairDraft) => void
}) {
  const [draft, setDraft] = useState<FlairDraft>(initial)

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setDraft(initial)
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="flair-text">Text</Label>
            <Input
              id="flair-text"
              value={draft.text}
              maxLength={64}
              onChange={(e) => {
                setDraft((d) => ({ ...d, text: e.target.value }))
              }}
            />
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="flair-bg">Background</Label>
              <input
                id="flair-bg"
                type="color"
                aria-label="Background color"
                className="h-9 w-16 cursor-pointer rounded-md border bg-transparent"
                value={draft.bgColor}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, bgColor: e.target.value }))
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="flair-fg">Text color</Label>
              <input
                id="flair-fg"
                type="color"
                aria-label="Text color"
                className="h-9 w-16 cursor-pointer rounded-md border bg-transparent"
                value={draft.textColor}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, textColor: e.target.value }))
                }}
              />
            </div>
            <div className="flex flex-col justify-end gap-1.5">
              <Label>Preview</Label>
              <FlairPreview template={draft} />
            </div>
          </div>
          <Label className="flex items-center justify-between gap-2">
            <span className="text-sm">Moderators only</span>
            <Switch
              checked={draft.modOnly}
              onCheckedChange={(checked) => {
                setDraft((d) => ({ ...d, modOnly: checked }))
              }}
            />
          </Label>
          {kind === "user" ? (
            <Label className="flex items-center justify-between gap-2">
              <span className="text-sm">Self-assignable</span>
              <Switch
                checked={draft.selfAssignable}
                onCheckedChange={(checked) => {
                  setDraft((d) => ({ ...d, selfAssignable: checked }))
                }}
              />
            </Label>
          ) : null}
        </div>
        <DialogFooter>
          <LoadingButton
            loading={saving}
            disabled={draft.text.trim() === ""}
            onClick={() => {
              onSubmit(draft)
            }}
          >
            Save
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** CRUD manager for a community's post-flair or user-flair templates. */
export function FlairManager({ communityId, kind }: { communityId: string; kind: FlairKind }) {
  const queryClient = useQueryClient()
  const postOptions = getApiV1FlairByCommunityIdPostTemplatesOptions({ path: { communityId } })
  const userOptions = getApiV1FlairByCommunityIdUserTemplatesOptions({ path: { communityId } })
  const postQuery = useQuery({ ...postOptions, enabled: kind === "post" })
  const userQuery = useQuery({ ...userOptions, enabled: kind === "user" })
  const data = kind === "post" ? postQuery.data : userQuery.data
  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: kind === "post" ? postOptions.queryKey : userOptions.queryKey,
    })
  }

  const createPost = useMutation(postApiV1FlairByCommunityIdPostTemplatesMutation())
  const createUser = useMutation(postApiV1FlairByCommunityIdUserTemplatesMutation())
  const updatePost = useMutation(patchApiV1FlairPostTemplatesByIdMutation())
  const updateUser = useMutation(patchApiV1FlairUserTemplatesByIdMutation())
  const deletePost = useMutation(deleteApiV1FlairPostTemplatesByIdMutation())
  const deleteUser = useMutation(deleteApiV1FlairUserTemplatesByIdMutation())

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<FlairTemplate | null>(null)

  const create = kind === "post" ? createPost : createUser
  const update = kind === "post" ? updatePost : updateUser
  const remove = kind === "post" ? deletePost : deleteUser
  const templates = (data?.data ?? []) as FlairTemplate[]

  function bodyFromDraft(draft: FlairDraft) {
    const base = {
      text: draft.text.trim(),
      bgColor: draft.bgColor,
      textColor: draft.textColor,
      modOnly: draft.modOnly,
    }
    return kind === "user" ? { ...base, selfAssignable: draft.selfAssignable } : base
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{kind === "post" ? "Post flair" : "User flair"}</h4>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setCreateOpen(true)
          }}
        >
          <Plus className="size-4" />
          Add
        </Button>
      </div>
      {templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No {kind} flair yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {templates.map((template) => (
            <div key={template.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
              <FlairPreview
                template={{
                  text: template.text,
                  bgColor: template.bgColor ?? "#e5e7eb",
                  textColor: template.textColor ?? "#111827",
                }}
              />
              {template.modOnly ? (
                <Badge variant="outline" className="text-[10px]">
                  Mod only
                </Badge>
              ) : null}
              {template.selfAssignable ? (
                <Badge variant="outline" className="text-[10px]">
                  Self-assignable
                </Badge>
              ) : null}
              <div className="ml-auto flex gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Edit flair"
                  onClick={() => {
                    setEditing(template)
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete flair"
                  onClick={() => {
                    remove.mutate(
                      { path: { id: template.id } },
                      {
                        onSuccess: invalidate,
                        onError: () => {
                          toast.error("Could not delete flair")
                        },
                      },
                    )
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <FlairDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        kind={kind}
        heading={`Add ${kind} flair`}
        initial={{
          text: "",
          bgColor: "#e5e7eb",
          textColor: "#111827",
          modOnly: false,
          selfAssignable: kind === "user",
        }}
        saving={create.isPending}
        onSubmit={(draft) => {
          create.mutate(
            { path: { communityId }, body: bodyFromDraft(draft) },
            {
              onSuccess: () => {
                toast.success("Flair created")
                setCreateOpen(false)
                invalidate()
              },
              onError: () => {
                toast.error("Could not create flair")
              },
            },
          )
        }}
      />
      {editing ? (
        <FlairDialog
          open
          onOpenChange={(o) => {
            if (!o) setEditing(null)
          }}
          kind={kind}
          heading={`Edit ${kind} flair`}
          initial={{
            text: editing.text,
            bgColor: editing.bgColor ?? "#e5e7eb",
            textColor: editing.textColor ?? "#111827",
            modOnly: editing.modOnly,
            selfAssignable: editing.selfAssignable ?? false,
          }}
          saving={update.isPending}
          onSubmit={(draft) => {
            update.mutate(
              { path: { id: editing.id }, body: bodyFromDraft(draft) },
              {
                onSuccess: () => {
                  toast.success("Flair updated")
                  setEditing(null)
                  invalidate()
                },
                onError: () => {
                  toast.error("Could not update flair")
                },
              },
            )
          }}
        />
      ) : null}
    </div>
  )
}
