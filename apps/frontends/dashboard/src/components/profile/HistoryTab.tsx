import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@ui/base/ui/button"
import { EngagementPostList } from "@frontends/dashboard/components/EngagementPostList"
import type { FeedPost } from "@frontends/dashboard/components/PostFeed"
import {
  deleteApiV1HistoryRecentPosts,
  getApiV1HistoryPosts,
} from "@lib/api-client/generated/sdk.gen"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { FeedViewMenu } from "./FeedViewMenu"
import { useFeedView } from "./useFeedView"

const HISTORY_QUERY_KEY = ["me", "history"]

function permalinkForPost(post: FeedPost): string {
  return post.community
    ? `/r/${post.community.name}/comments/${post.id}`
    : `/user/${post.author?.username ?? ""}`
}

async function fetchHistoryPage(
  cursor: string | undefined,
): Promise<{ posts: FeedPost[]; nextCursor: string | null }> {
  const { data } = await getApiV1HistoryPosts({ query: { cursor }, throwOnError: true })
  return { posts: data.data, nextCursor: data.nextCursor }
}

/**
 * Recently viewed posts — own profile only, private. Shown both in the profile
 * tab bar and at the dedicated /user/$username/history route.
 */
export function HistoryTab() {
  const queryClient = useQueryClient()
  const { view, setView } = useFeedView()

  const clear = useMutation({
    mutationFn: () => deleteApiV1HistoryRecentPosts({ throwOnError: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: HISTORY_QUERY_KEY })
      toast.success("Cleared your history")
    },
    onError: () => {
      toast.error("Could not clear history")
    },
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          disabled={clear.isPending}
          onClick={() => {
            clear.mutate()
          }}
        >
          <Trash2 className="size-4" />
          Clear history
        </Button>
        <div className="ml-auto">
          <FeedViewMenu view={view} onChange={setView} />
        </div>
      </div>
      <EngagementPostList
        queryKey={HISTORY_QUERY_KEY}
        fetchPage={fetchHistoryPage}
        permalinkFor={permalinkForPost}
        view={view}
        emptyTitle="No history yet"
        emptyDescription="Posts you view appear here. Only you can see this."
      />
    </div>
  )
}
