import { useInfiniteQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Button } from "@ui/base/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ui/base/ui/table"
import { RelativeTime } from "@ui/seo-shared/RelativeTime"
import { SeoLink } from "@ui/seo-shared/_internal/seo-link"
import { useModCommunity } from "@frontends/dashboard/components/mod/useModCommunity"
import { getApiV1ModLogByCommunityId } from "@lib/api-client/generated/sdk.gen"

export const Route = createFileRoute("/mod/$name/log")({
  component: ModLogPage,
})

type LogEntry = {
  id: string
  action: string
  details: { [key: string]: unknown } | null
  createdAt: string | Date
  modUsername: string | null
  targetPostId: string | null
  targetPostTitle: string | null
  targetCommentId: string | null
  targetUsername: string | null
}

function TargetCell({ entry, name }: { entry: LogEntry; name: string }) {
  if (entry.targetPostId) {
    return (
      <SeoLink
        href={`/r/${name}/comments/${entry.targetPostId}`}
        className="text-primary hover:underline"
      >
        {entry.targetPostTitle ?? "post"}
      </SeoLink>
    )
  }
  if (entry.targetCommentId && entry.targetPostId) {
    return (
      <SeoLink
        href={`/r/${name}/comments/${entry.targetPostId}`}
        className="text-primary hover:underline"
      >
        comment
      </SeoLink>
    )
  }
  if (entry.targetUsername) {
    return (
      <SeoLink href={`/user/${entry.targetUsername}`} className="text-primary hover:underline">
        u/{entry.targetUsername}
      </SeoLink>
    )
  }
  return <span className="text-muted-foreground">—</span>
}

function ModLogInner({ communityId, name }: { communityId: string; name: string }) {
  const query = useInfiniteQuery({
    queryKey: ["mod-log", communityId],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data } = await getApiV1ModLogByCommunityId({
        path: { communityId },
        query: { cursor: pageParam },
        throwOnError: true,
      })
      return data
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })

  const entries = (query.data?.pages.flatMap((p) => p.data) ?? []) as LogEntry[]

  if (query.isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading...</p>
  }
  if (entries.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">No moderation actions yet.</p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Mod Log</h2>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Mod</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  <RelativeTime date={entry.createdAt} />
                </TableCell>
                <TableCell className="text-sm">
                  {entry.modUsername ? `u/${entry.modUsername}` : "—"}
                </TableCell>
                <TableCell className="text-sm font-medium">
                  {entry.action.replaceAll("_", " ")}
                </TableCell>
                <TableCell className="max-w-48 truncate text-sm">
                  <TargetCell entry={entry} name={name} />
                </TableCell>
                <TableCell className="max-w-48 truncate text-xs text-muted-foreground">
                  {entry.details ? JSON.stringify(entry.details) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {query.hasNextPage ? (
        <div className="text-center">
          <Button
            variant="outline"
            size="sm"
            disabled={query.isFetchingNextPage}
            onClick={() => {
              void query.fetchNextPage()
            }}
          >
            {query.isFetchingNextPage ? "Loading..." : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function ModLogPage() {
  const { name } = Route.useParams()
  const { communityId, aggregate, isLoading } = useModCommunity(name)

  if (aggregate) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Choose a specific community to view its mod log.
      </p>
    )
  }
  if (isLoading || !communityId) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading...</p>
  }

  return <ModLogInner communityId={communityId} name={name} />
}
