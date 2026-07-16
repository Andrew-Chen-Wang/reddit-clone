import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Button } from "@ui/base/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@ui/base/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@ui/base/ui/dialog"
import { Input } from "@ui/base/ui/input"
import { Label } from "@ui/base/ui/label"
import { LoadingButton } from "@ui/base/ui/loading-button"
import { Textarea } from "@ui/base/ui/textarea"
import { useModCommunity } from "@frontends/dashboard/components/mod/useModCommunity"
import {
  deleteApiV1CommunityRuleByIdMutation,
  deleteApiV1RemovalReasonReasonByIdMutation,
  getApiV1CommunityRuleByCommunityIdOptions,
  getApiV1RemovalReasonByCommunityIdOptions,
  patchApiV1CommunityRuleByIdMutation,
  patchApiV1RemovalReasonByCommunityIdReorderMutation,
  patchApiV1RemovalReasonReasonByIdMutation,
  postApiV1CommunityRuleByCommunityIdMutation,
  postApiV1RemovalReasonByCommunityIdMutation,
  putApiV1CommunityRuleByCommunityIdReorderMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

export const Route = createFileRoute("/mod/$name/rules")({
  component: RulesPage,
})

type Entity = { id: string; title: string; body: string }

/** Shared create/edit dialog for a titled entity with a longer body field. */
function EntityDialog({
  open,
  onOpenChange,
  heading,
  titleLabel,
  bodyLabel,
  bodyRequired,
  initial,
  saving,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  heading: string
  titleLabel: string
  bodyLabel: string
  bodyRequired?: boolean
  initial: { title: string; body: string }
  saving: boolean
  onSubmit: (values: { title: string; body: string }) => void
}) {
  const [title, setTitle] = useState(initial.title)
  const [body, setBody] = useState(initial.body)

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setTitle(initial.title)
          setBody(initial.body)
        }
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="entity-title">{titleLabel}</Label>
            <Input
              id="entity-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="entity-body">{bodyLabel}</Label>
            <Textarea
              id="entity-body"
              rows={4}
              value={body}
              onChange={(e) => {
                setBody(e.target.value)
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <LoadingButton
            loading={saving}
            disabled={title.trim() === "" || (bodyRequired === true && body.trim() === "")}
            onClick={() => {
              onSubmit({ title: title.trim(), body: body.trim() })
            }}
          >
            Save
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReorderControls({
  index,
  count,
  onMove,
}: {
  index: number
  count: number
  onMove: (dir: -1 | 1) => void
}) {
  return (
    <div className="flex flex-col">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Move up"
        disabled={index === 0}
        onClick={() => {
          onMove(-1)
        }}
      >
        <ChevronUp className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Move down"
        disabled={index === count - 1}
        onClick={() => {
          onMove(1)
        }}
      >
        <ChevronDown className="size-4" />
      </Button>
    </div>
  )
}

function moveInArray<T>(arr: T[], index: number, dir: -1 | 1): T[] {
  const next = [...arr]
  const target = index + dir
  if (target < 0 || target >= next.length) return arr
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

function RulesSection({ communityId }: { communityId: string }) {
  const queryClient = useQueryClient()
  const options = getApiV1CommunityRuleByCommunityIdOptions({ path: { communityId } })
  const { data } = useQuery(options)
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: options.queryKey })
  }
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Entity | null>(null)

  const create = useMutation({
    ...postApiV1CommunityRuleByCommunityIdMutation(),
    onSuccess: () => {
      toast.success("Rule added")
      setCreateOpen(false)
      invalidate()
    },
    onError: () => {
      toast.error("Could not add rule")
    },
  })
  const update = useMutation({
    ...patchApiV1CommunityRuleByIdMutation(),
    onSuccess: () => {
      toast.success("Rule updated")
      setEditing(null)
      invalidate()
    },
    onError: () => {
      toast.error("Could not update rule")
    },
  })
  const remove = useMutation({
    ...deleteApiV1CommunityRuleByIdMutation(),
    onSuccess: invalidate,
    onError: () => {
      toast.error("Could not delete rule")
    },
  })
  const reorder = useMutation({
    ...putApiV1CommunityRuleByCommunityIdReorderMutation(),
    onError: () => {
      toast.error("Could not reorder rules")
      invalidate()
    },
  })

  const rules = data?.data ?? []

  function move(index: number, dir: -1 | 1) {
    const next = moveInArray(rules, index, dir)
    if (next === rules) return
    queryClient.setQueryData(options.queryKey, { data: next })
    reorder.mutate({ path: { communityId }, body: { orderedIds: next.map((r) => r.id) } })
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Community rules</CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setCreateOpen(true)
          }}
        >
          <Plus className="size-4" />
          Add rule
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rules yet.</p>
        ) : (
          rules.map((rule, index) => (
            <div key={rule.id} className="flex items-start gap-2 rounded-md border p-2.5">
              <ReorderControls
                index={index}
                count={rules.length}
                onMove={(dir) => {
                  move(index, dir)
                }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {index + 1}. {rule.name}
                </p>
                {rule.description ? (
                  <p className="text-sm text-muted-foreground">{rule.description}</p>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Edit rule"
                onClick={() => {
                  setEditing({ id: rule.id, title: rule.name, body: rule.description ?? "" })
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Delete rule"
                onClick={() => {
                  remove.mutate({ path: { id: rule.id } })
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))
        )}
      </CardContent>

      <EntityDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        heading="Add rule"
        titleLabel="Rule name"
        bodyLabel="Description"
        initial={{ title: "", body: "" }}
        saving={create.isPending}
        onSubmit={({ title, body }) => {
          create.mutate({
            path: { communityId },
            body: { name: title, description: body === "" ? null : body },
          })
        }}
      />
      {editing ? (
        <EntityDialog
          open
          onOpenChange={(o) => {
            if (!o) setEditing(null)
          }}
          heading="Edit rule"
          titleLabel="Rule name"
          bodyLabel="Description"
          initial={{ title: editing.title, body: editing.body }}
          saving={update.isPending}
          onSubmit={({ title, body }) => {
            update.mutate({
              path: { id: editing.id },
              body: { name: title, description: body === "" ? null : body },
            })
          }}
        />
      ) : null}
    </Card>
  )
}

function RemovalReasonsSection({ communityId }: { communityId: string }) {
  const queryClient = useQueryClient()
  const options = getApiV1RemovalReasonByCommunityIdOptions({ path: { communityId } })
  const { data } = useQuery(options)
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: options.queryKey })
  }
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Entity | null>(null)

  const create = useMutation({
    ...postApiV1RemovalReasonByCommunityIdMutation(),
    onSuccess: () => {
      toast.success("Removal reason added")
      setCreateOpen(false)
      invalidate()
    },
    onError: () => {
      toast.error("Could not add removal reason")
    },
  })
  const update = useMutation({
    ...patchApiV1RemovalReasonReasonByIdMutation(),
    onSuccess: () => {
      toast.success("Removal reason updated")
      setEditing(null)
      invalidate()
    },
    onError: () => {
      toast.error("Could not update removal reason")
    },
  })
  const remove = useMutation({
    ...deleteApiV1RemovalReasonReasonByIdMutation(),
    onSuccess: invalidate,
    onError: () => {
      toast.error("Could not delete removal reason")
    },
  })
  const reorder = useMutation({
    ...patchApiV1RemovalReasonByCommunityIdReorderMutation(),
    onError: () => {
      toast.error("Could not reorder")
      invalidate()
    },
  })

  const reasons = data?.data ?? []

  function move(index: number, dir: -1 | 1) {
    const next = moveInArray(reasons, index, dir)
    if (next === reasons) return
    queryClient.setQueryData(options.queryKey, { data: next })
    reorder.mutate({ path: { communityId }, body: { orderedIds: next.map((r) => r.id) } })
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Removal reasons</CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setCreateOpen(true)
          }}
        >
          <Plus className="size-4" />
          Add reason
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">
          Shown when removing content and sent to the author.
        </p>
        {reasons.length === 0 ? (
          <p className="text-sm text-muted-foreground">No removal reasons yet.</p>
        ) : (
          reasons.map((reason, index) => (
            <div key={reason.id} className="flex items-start gap-2 rounded-md border p-2.5">
              <ReorderControls
                index={index}
                count={reasons.length}
                onMove={(dir) => {
                  move(index, dir)
                }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{reason.title}</p>
                <p className="text-sm text-muted-foreground">{reason.message}</p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Edit removal reason"
                onClick={() => {
                  setEditing({ id: reason.id, title: reason.title, body: reason.message })
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Delete removal reason"
                onClick={() => {
                  remove.mutate({ path: { id: reason.id } })
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))
        )}
      </CardContent>

      <EntityDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        heading="Add removal reason"
        titleLabel="Title"
        bodyLabel="Message to author"
        bodyRequired
        initial={{ title: "", body: "" }}
        saving={create.isPending}
        onSubmit={({ title, body }) => {
          create.mutate({ path: { communityId }, body: { title, message: body } })
        }}
      />
      {editing ? (
        <EntityDialog
          open
          onOpenChange={(o) => {
            if (!o) setEditing(null)
          }}
          heading="Edit removal reason"
          titleLabel="Title"
          bodyLabel="Message to author"
          bodyRequired
          initial={{ title: editing.title, body: editing.body }}
          saving={update.isPending}
          onSubmit={({ title, body }) => {
            update.mutate({ path: { id: editing.id }, body: { title, message: body } })
          }}
        />
      ) : null}
    </Card>
  )
}

function RulesPage() {
  const { name } = Route.useParams()
  const { communityId, aggregate, isLoading } = useModCommunity(name)

  if (aggregate) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Choose a specific community to manage rules.
      </p>
    )
  }
  if (isLoading || !communityId) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading...</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <RulesSection communityId={communityId} />
      <RemovalReasonsSection communityId={communityId} />
    </div>
  )
}
