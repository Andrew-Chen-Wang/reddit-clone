import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Button } from "@ui/base/ui/button"
import { Card, CardContent } from "@ui/base/ui/card"
import { CommunityIcon } from "@ui/seo-shared/community/CommunityIcon"
import { mediaUrl } from "@frontends/dashboard/lib/mediaUrl"
import { formatCompactNumber } from "@ui/seo-shared/format-number"
import {
  deleteApiV1HistoryRecentPostsMutation,
  getApiV1HistoryRecentPostsOptions,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { toast } from "sonner"

/** "Recent Posts" card for the home right rail, backed by view history. */
export function RecentPostsRail() {
  const queryClient = useQueryClient()
  const { data } = useQuery(getApiV1HistoryRecentPostsOptions())
  const clear = useMutation({
    ...deleteApiV1HistoryRecentPostsMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: getApiV1HistoryRecentPostsOptions().queryKey })
    },
    onError: () => {
      toast.error("Could not clear history")
    },
  })

  const posts = data?.data ?? []
  if (posts.length === 0) return null

  return (
    <Card>
      {/* Explicit flex row: base CardHeader is display:grid, so justify-between
          can't right-align the Clear action there. */}
      <div className="flex items-center justify-between gap-2 px-4 pb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Recent Posts
        </span>
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs"
          disabled={clear.isPending}
          onClick={() => {
            clear.mutate({})
          }}
        >
          Clear
        </Button>
      </div>
      <CardContent className="flex flex-col gap-3">
        {posts.map((post) => {
          const permalink = post.communityName
            ? `/r/${post.communityName}/comments/${post.postId}`
            : `/`
          return (
            <Link
              key={post.postId}
              to={permalink}
              className="flex flex-col gap-1 rounded-md p-1 hover:bg-muted"
            >
              {post.communityName ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CommunityIcon
                    name={post.communityName}
                    iconUrl={mediaUrl(post.communityIconImageKey)}
                    size="sm"
                  />
                  r/{post.communityName}
                </div>
              ) : null}
              <span className="line-clamp-2 text-sm font-medium">{post.title}</span>
              <span className="text-xs text-muted-foreground">
                {formatCompactNumber(post.score)} points · {formatCompactNumber(post.commentCount)}{" "}
                comments
              </span>
            </Link>
          )
        })}
      </CardContent>
    </Card>
  )
}
