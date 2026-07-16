import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { Button, buttonVariants } from "@ui/base/ui/button"
import { cn } from "@ui/base/lib/utils"
import { Card, CardContent } from "@ui/base/ui/card"
import { Input } from "@ui/base/ui/input"
import { Label } from "@ui/base/ui/label"
import { LoadingButton } from "@ui/base/ui/loading-button"
import { Markdown } from "@ui/seo-shared/Markdown"
import { MarkdownEditor } from "@ui/spa-shared/MarkdownEditor"
import {
  getApiV1WikiByCommunityNameBySlugOptions,
  getApiV1WikiByCommunityNameBySlugRevisionsOptions,
  getApiV1WikiByCommunityNameOptions,
  postApiV1WikiByCommunityNameBySlugRevertMutation,
  putApiV1WikiByCommunityNameBySlugMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { History, Pencil, RotateCcw } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

export const Route = createFileRoute("/r_/$name/wiki/$")({
  component: WikiPage,
})

function WikiIndex({ name }: { name: string }) {
  const { data } = useQuery(getApiV1WikiByCommunityNameOptions({ path: { communityName: name } }))
  const pages = data?.data ?? []
  const hasIndex = pages.some((page) => page.slug === "index")
  const { data: indexPage } = useQuery({
    ...getApiV1WikiByCommunityNameBySlugOptions({ path: { communityName: name, slug: "index" } }),
    enabled: hasIndex,
  })

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">r/{name} Wiki</h1>
        {data?.canEdit ? (
          <Link
            to="/mod/$name/wiki"
            params={{ name }}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Pencil className="size-4" />
            Manage pages
          </Link>
        ) : null}
      </div>
      {indexPage?.bodyMd ? (
        <Card className="mb-4">
          <CardContent className="py-6">
            <Markdown content={indexPage.bodyMd} />
          </CardContent>
        </Card>
      ) : null}
      {pages.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <p className="text-sm font-medium text-muted-foreground">This wiki has no pages yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-1 py-4">
            {pages.map((page) => (
              <Link
                key={page.id}
                to="/r/$name/wiki/$"
                params={{ name, _splat: page.slug }}
                className="rounded-md px-3 py-2 text-sm hover:bg-accent"
              >
                {page.title}
                <span className="ml-2 text-xs text-muted-foreground">/{page.slug}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function RevisionHistory({ name, slug }: { name: string; slug: string }) {
  const queryClient = useQueryClient()
  const options = getApiV1WikiByCommunityNameBySlugRevisionsOptions({
    path: { communityName: name, slug },
  })
  const { data } = useQuery(options)
  const revert = useMutation({
    ...postApiV1WikiByCommunityNameBySlugRevertMutation(),
    onSuccess: () => {
      toast.success("Page reverted")
      void queryClient.invalidateQueries({
        queryKey: getApiV1WikiByCommunityNameBySlugOptions({ path: { communityName: name, slug } })
          .queryKey,
      })
      void queryClient.invalidateQueries({ queryKey: options.queryKey })
    },
    onError: () => {
      toast.error("Could not revert")
    },
  })
  const revisions = data?.data ?? []

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 py-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Revision history
        </h2>
        {revisions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No revisions.</p>
        ) : (
          revisions.map((revision, index) => (
            <div
              key={revision.id}
              className="flex items-center gap-2 rounded-md border p-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate">
                  {revision.note ?? "Edited"}
                  {index === 0 ? <span className="ml-2 text-xs text-primary">current</span> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {revision.author ? `u/${revision.author.username} · ` : ""}
                  {new Date(revision.createdAt).toLocaleString()}
                </p>
              </div>
              {index !== 0 ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Revert to this revision"
                  onClick={() => {
                    revert.mutate({
                      path: { communityName: name, slug },
                      body: { revisionId: revision.id },
                    })
                  }}
                >
                  <RotateCcw className="size-4" />
                </Button>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function WikiPageView({ name, slug }: { name: string; slug: string }) {
  const queryClient = useQueryClient()
  const options = getApiV1WikiByCommunityNameBySlugOptions({ path: { communityName: name, slug } })
  const { data: page, isLoading, isError } = useQuery(options)
  const [editing, setEditing] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [body, setBody] = useState("")
  const [note, setNote] = useState("")

  const save = useMutation({
    ...putApiV1WikiByCommunityNameBySlugMutation(),
    onSuccess: () => {
      toast.success("Page saved")
      setEditing(false)
      setNote("")
      void queryClient.invalidateQueries({ queryKey: options.queryKey })
      void queryClient.invalidateQueries({
        queryKey: getApiV1WikiByCommunityNameBySlugRevisionsOptions({
          path: { communityName: name, slug },
        }).queryKey,
      })
    },
    onError: () => {
      toast.error("Could not save page")
    },
  })

  if (isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading...</p>
  }
  if (isError || !page) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-xl font-semibold">Page not found</h1>
        <Link
          to="/r/$name/wiki/$"
          params={{ name, _splat: "" }}
          className="text-sm text-primary hover:underline"
        >
          Back to wiki
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{page.title}</h1>
          {page.updatedAt ? (
            <p className="text-xs text-muted-foreground">
              Last edited {new Date(page.updatedAt).toLocaleString()}
              {page.author ? ` by u/${page.author.username}` : ""}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowHistory((v) => !v)
            }}
          >
            <History className="size-4" />
            History
          </Button>
          {page.canEdit && !editing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setBody(page.bodyMd ?? "")
                setEditing(true)
              }}
            >
              <Pencil className="size-4" />
              Edit
            </Button>
          ) : null}
        </div>
      </div>

      {editing ? (
        <div className="flex flex-col gap-3">
          <MarkdownEditor
            value={body}
            onChange={setBody}
            minRows={12}
            renderPreview={(md) => <Markdown content={md} />}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wiki-note">Edit note (optional)</Label>
            <Input
              id="wiki-note"
              value={note}
              onChange={(e) => {
                setNote(e.target.value)
              }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setEditing(false)
              }}
            >
              Cancel
            </Button>
            <LoadingButton
              loading={save.isPending}
              onClick={() => {
                save.mutate({
                  path: { communityName: name, slug },
                  body: { body, note: note.trim() === "" ? null : note.trim() },
                })
              }}
            >
              Save
            </LoadingButton>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="py-6">
            {page.bodyMd && page.bodyMd.trim() !== "" ? (
              <Markdown content={page.bodyMd} />
            ) : (
              <p className="text-sm text-muted-foreground">This page is empty.</p>
            )}
          </CardContent>
        </Card>
      )}

      {showHistory ? (
        <div className="mt-4">
          <RevisionHistory name={name} slug={slug} />
        </div>
      ) : null}
    </div>
  )
}

function WikiPage() {
  const params = Route.useParams()
  const name = params.name
  const slug = params._splat ?? ""

  if (slug === "") return <WikiIndex name={name} />
  return <WikiPageView name={name} slug={slug} />
}
