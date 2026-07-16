import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { buttonVariants } from "@ui/base/ui/button"
import { cn } from "@ui/base/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@ui/base/ui/card"
import { Input } from "@ui/base/ui/input"
import { Label } from "@ui/base/ui/label"
import { LoadingButton } from "@ui/base/ui/loading-button"
import { Markdown } from "@ui/seo-shared/Markdown"
import { MarkdownEditor } from "@ui/spa-shared/MarkdownEditor"
import { useModCommunity } from "@frontends/dashboard/components/mod/useModCommunity"
import {
  getApiV1WikiByCommunityNameOptions,
  postApiV1WikiByCommunityNameMutation,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { ExternalLink } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

export const Route = createFileRoute("/mod/$name/wiki")({
  component: WikiManagementPage,
})

function CreatePageForm({ name }: { name: string }) {
  const queryClient = useQueryClient()
  const [slug, setSlug] = useState("")
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")

  const create = useMutation({
    ...postApiV1WikiByCommunityNameMutation(),
    onSuccess: () => {
      toast.success("Page created")
      setSlug("")
      setTitle("")
      setBody("")
      void queryClient.invalidateQueries({
        queryKey: getApiV1WikiByCommunityNameOptions({ path: { communityName: name } }).queryKey,
      })
    },
    onError: () => {
      toast.error("Could not create page (the slug may already exist)")
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a wiki page</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wiki-title">Title</Label>
          <Input
            id="wiki-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wiki-slug">Slug</Label>
          <Input
            id="wiki-slug"
            value={slug}
            placeholder="e.g. index or rules/detailed"
            onChange={(e) => {
              setSlug(e.target.value)
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wiki-body">Content</Label>
          <MarkdownEditor
            id="wiki-body"
            value={body}
            onChange={setBody}
            minRows={8}
            renderPreview={(md) => <Markdown content={md} />}
          />
        </div>
        <div className="flex justify-end">
          <LoadingButton
            loading={create.isPending}
            disabled={title.trim() === "" || slug.trim() === ""}
            onClick={() => {
              create.mutate({
                path: { communityName: name },
                body: { slug: slug.trim(), title: title.trim(), body },
              })
            }}
          >
            Create page
          </LoadingButton>
        </div>
      </CardContent>
    </Card>
  )
}

function PagesList({ name }: { name: string }) {
  const { data } = useQuery(getApiV1WikiByCommunityNameOptions({ path: { communityName: name } }))
  const pages = data?.data ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wiki pages</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {pages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pages yet.</p>
        ) : (
          pages.map((page) => (
            <div key={page.id} className="flex items-center gap-2 rounded-md border p-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{page.title}</p>
                <p className="text-xs text-muted-foreground">/{page.slug}</p>
              </div>
              <Link
                to="/r/$name/wiki/$"
                params={{ name, _splat: page.slug }}
                className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
                aria-label="View and edit page"
              >
                <ExternalLink className="size-4" />
              </Link>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function WikiManagementPage() {
  const { name } = Route.useParams()
  const { aggregate, isLoading, communityId } = useModCommunity(name)

  if (aggregate) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Choose a specific community to manage its wiki.
      </p>
    )
  }
  if (isLoading || !communityId) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading...</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <CreatePageForm name={name} />
      <PagesList name={name} />
    </div>
  )
}
