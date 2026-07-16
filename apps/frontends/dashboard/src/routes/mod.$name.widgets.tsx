import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Button } from "@ui/base/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ui/base/ui/command"
import { Card, CardContent, CardHeader, CardTitle } from "@ui/base/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@ui/base/ui/dialog"
import { Input } from "@ui/base/ui/input"
import { Label } from "@ui/base/ui/label"
import { LoadingButton } from "@ui/base/ui/loading-button"
import { Popover, PopoverContent, PopoverTrigger } from "@ui/base/ui/popover"
import { Markdown } from "@ui/seo-shared/Markdown"
import { MarkdownEditor } from "@ui/spa-shared/MarkdownEditor"
import { CommunityIcon } from "@ui/seo-shared/community/CommunityIcon"
import { useModCommunity } from "@frontends/dashboard/components/mod/useModCommunity"
import { mediaUrl } from "@frontends/dashboard/lib/mediaUrl"
import {
  deleteApiV1CommunityWidgetBookmarkByIdMutation,
  deleteApiV1CommunityWidgetWidgetByIdMutation,
  getApiV1CommunityMemberMineOptions,
  getApiV1CommunityWidgetByCommunityNameOptions,
  patchApiV1CommunityWidgetBookmarkByIdMutation,
  patchApiV1CommunityWidgetWidgetByIdMutation,
  postApiV1CommunityWidgetByCommunityIdBookmarkMutation,
  postApiV1CommunityWidgetByCommunityIdWidgetMutation,
  putApiV1CommunityWidgetByCommunityIdBookmarkReorderMutation,
  putApiV1CommunityWidgetByCommunityIdRelatedMutation,
  putApiV1CommunityWidgetByCommunityIdWidgetReorderMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

export const Route = createFileRoute("/mod/$name/widgets")({
  component: WidgetsPage,
})

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

type JoinedCommunity = {
  id: string
  name: string
  displayName: string | null
  iconImageKey: string | null
}

function BookmarkDialog({
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
  initial: { label: string; url: string }
  saving: boolean
  onSubmit: (values: { label: string; url: string }) => void
}) {
  const [label, setLabel] = useState(initial.label)
  const [url, setUrl] = useState(initial.url)

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setLabel(initial.label)
          setUrl(initial.url)
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
            <Label htmlFor="bookmark-label">Label</Label>
            <Input
              id="bookmark-label"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value)
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bookmark-url">URL</Label>
            <Input
              id="bookmark-url"
              value={url}
              placeholder="https://..."
              onChange={(e) => {
                setUrl(e.target.value)
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <LoadingButton
            loading={saving}
            disabled={label.trim() === "" || url.trim() === ""}
            onClick={() => {
              onSubmit({ label: label.trim(), url: url.trim() })
            }}
          >
            Save
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type Bookmark = { id: string; label: string; url: string }

function BookmarksSection({
  communityId,
  communityName,
}: {
  communityId: string
  communityName: string
}) {
  const queryClient = useQueryClient()
  const options = getApiV1CommunityWidgetByCommunityNameOptions({ path: { communityName } })
  const { data } = useQuery(options)
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: options.queryKey })
  }
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Bookmark | null>(null)

  const create = useMutation({
    ...postApiV1CommunityWidgetByCommunityIdBookmarkMutation(),
    onSuccess: () => {
      toast.success("Bookmark added")
      setCreateOpen(false)
      invalidate()
    },
    onError: () => {
      toast.error("Could not add bookmark")
    },
  })
  const update = useMutation({
    ...patchApiV1CommunityWidgetBookmarkByIdMutation(),
    onSuccess: () => {
      toast.success("Bookmark updated")
      setEditing(null)
      invalidate()
    },
    onError: () => {
      toast.error("Could not update bookmark")
    },
  })
  const remove = useMutation({
    ...deleteApiV1CommunityWidgetBookmarkByIdMutation(),
    onSuccess: invalidate,
    onError: () => {
      toast.error("Could not delete bookmark")
    },
  })
  const reorder = useMutation({
    ...putApiV1CommunityWidgetByCommunityIdBookmarkReorderMutation(),
    onError: () => {
      toast.error("Could not reorder")
      invalidate()
    },
  })

  const bookmarks = data?.bookmarks ?? []

  function move(index: number, dir: -1 | 1) {
    const next = moveInArray(bookmarks, index, dir)
    if (next === bookmarks) return
    queryClient.setQueryData(options.queryKey, (old) => (old ? { ...old, bookmarks: next } : old))
    reorder.mutate({ path: { communityId }, body: { orderedIds: next.map((b) => b.id) } })
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Bookmarks</CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setCreateOpen(true)
          }}
        >
          <Plus className="size-4" />
          Add bookmark
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {bookmarks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bookmarks yet.</p>
        ) : (
          bookmarks.map((bookmark, index) => (
            <div key={bookmark.id} className="flex items-center gap-2 rounded-md border p-2.5">
              <ReorderControls
                index={index}
                count={bookmarks.length}
                onMove={(dir) => {
                  move(index, dir)
                }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{bookmark.label}</p>
                <p className="truncate text-xs text-muted-foreground">{bookmark.url}</p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Edit bookmark"
                onClick={() => {
                  setEditing(bookmark)
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Delete bookmark"
                onClick={() => {
                  remove.mutate({ path: { id: bookmark.id } })
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))
        )}
      </CardContent>

      <BookmarkDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        heading="Add bookmark"
        initial={{ label: "", url: "" }}
        saving={create.isPending}
        onSubmit={({ label, url }) => {
          create.mutate({ path: { communityId }, body: { label, url } })
        }}
      />
      {editing ? (
        <BookmarkDialog
          open
          onOpenChange={(o) => {
            if (!o) setEditing(null)
          }}
          heading="Edit bookmark"
          initial={{ label: editing.label, url: editing.url }}
          saving={update.isPending}
          onSubmit={({ label, url }) => {
            update.mutate({ path: { id: editing.id }, body: { label, url } })
          }}
        />
      ) : null}
    </Card>
  )
}

function WidgetDialog({
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="widget-title">Title</Label>
            <Input
              id="widget-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="widget-body">Content</Label>
            <MarkdownEditor
              id="widget-body"
              value={body}
              onChange={setBody}
              minRows={6}
              renderPreview={(md) => <Markdown content={md} />}
            />
          </div>
        </div>
        <DialogFooter>
          <LoadingButton
            loading={saving}
            disabled={title.trim() === ""}
            onClick={() => {
              onSubmit({ title: title.trim(), body })
            }}
          >
            Save
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type TextWidget = { id: string; title: string; bodyMd: string }

function WidgetsSection({
  communityId,
  communityName,
}: {
  communityId: string
  communityName: string
}) {
  const queryClient = useQueryClient()
  const options = getApiV1CommunityWidgetByCommunityNameOptions({ path: { communityName } })
  const { data } = useQuery(options)
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: options.queryKey })
  }
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<TextWidget | null>(null)

  const create = useMutation({
    ...postApiV1CommunityWidgetByCommunityIdWidgetMutation(),
    onSuccess: () => {
      toast.success("Widget added")
      setCreateOpen(false)
      invalidate()
    },
    onError: () => {
      toast.error("Could not add widget")
    },
  })
  const update = useMutation({
    ...patchApiV1CommunityWidgetWidgetByIdMutation(),
    onSuccess: () => {
      toast.success("Widget updated")
      setEditing(null)
      invalidate()
    },
    onError: () => {
      toast.error("Could not update widget")
    },
  })
  const remove = useMutation({
    ...deleteApiV1CommunityWidgetWidgetByIdMutation(),
    onSuccess: invalidate,
    onError: () => {
      toast.error("Could not delete widget")
    },
  })
  const reorder = useMutation({
    ...putApiV1CommunityWidgetByCommunityIdWidgetReorderMutation(),
    onError: () => {
      toast.error("Could not reorder")
      invalidate()
    },
  })

  const widgets = data?.widgets ?? []

  function move(index: number, dir: -1 | 1) {
    const next = moveInArray(widgets, index, dir)
    if (next === widgets) return
    queryClient.setQueryData(options.queryKey, (old) => (old ? { ...old, widgets: next } : old))
    reorder.mutate({ path: { communityId }, body: { orderedIds: next.map((w) => w.id) } })
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Text widgets</CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setCreateOpen(true)
          }}
        >
          <Plus className="size-4" />
          Add widget
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {widgets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No text widgets yet.</p>
        ) : (
          widgets.map((widget, index) => (
            <div key={widget.id} className="flex items-start gap-2 rounded-md border p-2.5">
              <ReorderControls
                index={index}
                count={widgets.length}
                onMove={(dir) => {
                  move(index, dir)
                }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{widget.title}</p>
                <p className="truncate text-xs text-muted-foreground">{widget.bodyMd}</p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Edit widget"
                onClick={() => {
                  setEditing(widget)
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Delete widget"
                onClick={() => {
                  remove.mutate({ path: { id: widget.id } })
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))
        )}
      </CardContent>

      <WidgetDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        heading="Add widget"
        initial={{ title: "", body: "" }}
        saving={create.isPending}
        onSubmit={({ title, body }) => {
          create.mutate({ path: { communityId }, body: { title, body } })
        }}
      />
      {editing ? (
        <WidgetDialog
          open
          onOpenChange={(o) => {
            if (!o) setEditing(null)
          }}
          heading="Edit widget"
          initial={{ title: editing.title, body: editing.bodyMd }}
          saving={update.isPending}
          onSubmit={({ title, body }) => {
            update.mutate({ path: { id: editing.id }, body: { title, body } })
          }}
        />
      ) : null}
    </Card>
  )
}

type Related = {
  id: string
  name: string
  displayName: string | null
  iconImageKey: string | null
  memberCount: number
}

function RelatedSection({
  communityId,
  communityName,
}: {
  communityId: string
  communityName: string
}) {
  const queryClient = useQueryClient()
  const options = getApiV1CommunityWidgetByCommunityNameOptions({ path: { communityName } })
  const { data } = useQuery(options)
  const { data: mine } = useQuery(getApiV1CommunityMemberMineOptions())
  const [pickerOpen, setPickerOpen] = useState(false)
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: options.queryKey })
  }

  const setRelated = useMutation({
    ...putApiV1CommunityWidgetByCommunityIdRelatedMutation(),
    onSuccess: invalidate,
    onError: () => {
      toast.error("Could not update related communities")
      invalidate()
    },
  })

  const related = (data?.related ?? []) as Related[]

  function commit(next: Related[]) {
    queryClient.setQueryData(options.queryKey, (old) => (old ? { ...old, related: next } : old))
    setRelated.mutate({ path: { communityId }, body: { communityIds: next.map((r) => r.id) } })
  }

  function move(index: number, dir: -1 | 1) {
    const next = moveInArray(related, index, dir)
    if (next === related) return
    commit(next)
  }

  function removeAt(id: string) {
    commit(related.filter((r) => r.id !== id))
  }

  function add(community: JoinedCommunity) {
    if (community.id === communityId || related.some((r) => r.id === community.id)) return
    commit([
      ...related,
      {
        id: community.id,
        name: community.name,
        displayName: community.displayName,
        iconImageKey: community.iconImageKey,
        memberCount: 0,
      },
    ])
  }

  const existingIds = new Set(related.map((r) => r.id))
  const candidates = ((mine?.data ?? []) as JoinedCommunity[]).filter(
    (community) => community.id !== communityId && !existingIds.has(community.id),
  )

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Related communities</CardTitle>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger
            render={
              <Button size="sm">
                <Plus className="size-4" />
                Add
              </Button>
            }
          />
          <PopoverContent className="w-64 p-0" align="end">
            <Command>
              <CommandInput placeholder="Search communities..." />
              <CommandList>
                <CommandEmpty>No communities to add.</CommandEmpty>
                <CommandGroup>
                  {candidates.map((community) => (
                    <CommandItem
                      key={community.id}
                      value={community.name}
                      onSelect={() => {
                        add(community)
                        setPickerOpen(false)
                      }}
                    >
                      <CommunityIcon
                        name={community.name}
                        iconUrl={mediaUrl(community.iconImageKey)}
                        size="sm"
                      />
                      <span className="truncate">r/{community.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {related.length === 0 ? (
          <p className="text-sm text-muted-foreground">No related communities yet.</p>
        ) : (
          related.map((community, index) => (
            <div key={community.id} className="flex items-center gap-2 rounded-md border p-2.5">
              <ReorderControls
                index={index}
                count={related.length}
                onMove={(dir) => {
                  move(index, dir)
                }}
              />
              <CommunityIcon
                name={community.name}
                iconUrl={mediaUrl(community.iconImageKey)}
                size="sm"
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                r/{community.name}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remove related community"
                onClick={() => {
                  removeAt(community.id)
                }}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function WidgetsPage() {
  const { name } = Route.useParams()
  const { aggregate, isLoading, communityId } = useModCommunity(name)

  if (aggregate) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Choose a specific community to manage its widgets.
      </p>
    )
  }
  if (isLoading || !communityId) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading...</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <BookmarksSection communityId={communityId} communityName={name} />
      <WidgetsSection communityId={communityId} communityName={name} />
      <RelatedSection communityId={communityId} communityName={name} />
    </div>
  )
}
