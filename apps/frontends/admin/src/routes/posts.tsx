import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@ui/base/ui/alert-dialog"
import { Badge } from "@ui/base/ui/badge"
import { Button, buttonVariants } from "@ui/base/ui/button"
import { Input } from "@ui/base/ui/input"
import { cn } from "@ui/base/lib/utils"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ui/base/ui/table"
import {
  getApiAdminPostsOptions,
  getApiAdminPostsQueryKey,
  postApiAdminPostsByIdRemoveMutation,
  postApiAdminPostsByIdRestoreMutation,
} from "@frontends/admin/lib/adminApi"
import { useState } from "react"
import { toast } from "sonner"

export const Route = createFileRoute("/posts")({
  component: PostsPage,
})

function PostsPage() {
  const queryClient = useQueryClient()
  const [input, setInput] = useState("")
  const [q, setQ] = useState("")

  const listOptions = getApiAdminPostsOptions({ query: q ? { q } : {} })
  const { data, isLoading } = useQuery(listOptions)

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: getApiAdminPostsQueryKey() })
  }

  const removeMutation = useMutation({
    ...postApiAdminPostsByIdRemoveMutation(),
    onSuccess: () => {
      toast.success("Post removed")
      invalidate()
    },
    onError: () => toast.error("Could not remove post"),
  })

  const restoreMutation = useMutation({
    ...postApiAdminPostsByIdRestoreMutation(),
    onSuccess: () => {
      toast.success("Post restored")
      invalidate()
    },
    onError: () => toast.error("Could not restore post"),
  })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Posts</h1>
      </div>

      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setQ(input.trim())
        }}
      >
        <Input
          placeholder="Search by title"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
          }}
          className="max-w-sm"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Community</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : !data || data.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No posts found.
                </TableCell>
              </TableRow>
            ) : (
              data.data.map((post) => (
                <TableRow key={post.id}>
                  <TableCell className="max-w-xs truncate font-medium">{post.title}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {post.communityName ? `r/${post.communityName}` : "Profile"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {post.authorUsername ? `u/${post.authorUsername}` : "—"}
                  </TableCell>
                  <TableCell>{post.score.toLocaleString()}</TableCell>
                  <TableCell>
                    {post.removedAt ? (
                      <Badge variant="destructive">Removed</Badge>
                    ) : (
                      <Badge variant="secondary">Live</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {post.removedAt ? (
                      <PostActionDialog
                        triggerLabel="Restore"
                        triggerVariant="outline"
                        title="Restore this post?"
                        description="The post will become visible in feeds again."
                        confirmLabel="Restore"
                        onConfirm={() => {
                          restoreMutation.mutate({ path: { id: post.id } })
                        }}
                      />
                    ) : (
                      <PostActionDialog
                        triggerLabel="Remove"
                        triggerVariant="destructive"
                        title="Remove this post?"
                        description="The post will be hidden from all feeds site-wide."
                        confirmLabel="Remove"
                        destructive
                        onConfirm={() => {
                          removeMutation.mutate({ path: { id: post.id } })
                        }}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function PostActionDialog({
  triggerLabel,
  triggerVariant,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
}: {
  triggerLabel: string
  triggerVariant: "outline" | "destructive"
  title: string
  description: string
  confirmLabel: string
  destructive?: boolean
  onConfirm: () => void
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger className={cn(buttonVariants({ variant: triggerVariant, size: "sm" }))}>
        {triggerLabel}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={
              destructive ? "bg-destructive text-white hover:bg-destructive/90" : undefined
            }
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
