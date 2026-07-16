import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Card, CardContent } from "@ui/base/ui/card"
import { CommunityRightRail } from "@ui/seo-shared/community/CommunityRightRail"
import { PostDetailCard } from "@ui/seo-shared/post/PostDetailCard"
import {
  getApiV1CommunityByNameOptions,
  getApiV1PostByIdOptions,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { putApiV1PostVoteByPostId } from "@lib/api-client/generated/sdk.gen"
import { toast } from "sonner"

export const Route = createFileRoute("/r/$name/comments/$postId")({
  component: PostDetailPage,
})

type PostData = NonNullable<ReturnType<typeof usePost>["data"]>

function usePost(postId: string) {
  return useQuery(getApiV1PostByIdOptions({ path: { id: postId } }))
}

function nextVoteValue(current: number, direction: 1 | -1): 1 | 0 | -1 {
  if (direction === 1) return current === 1 ? 0 : 1
  return current === -1 ? 0 : -1
}

function PostDetailPage() {
  const { name, postId } = Route.useParams()
  const queryClient = useQueryClient()
  const postQuery = usePost(postId)
  const communityQuery = useQuery(getApiV1CommunityByNameOptions({ path: { name } }))

  const postKey = getApiV1PostByIdOptions({ path: { id: postId } }).queryKey

  const voteMutation = useMutation({
    mutationFn: (value: 1 | 0 | -1) =>
      putApiV1PostVoteByPostId({ path: { postId }, body: { value }, throwOnError: true }),
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: postKey })
      toast.error("Could not register your vote")
    },
  })

  function vote(direction: 1 | -1) {
    const post = postQuery.data
    if (!post) return
    const newVote = nextVoteValue(post.userVote, direction)
    queryClient.setQueryData<PostData>(postKey, (old) =>
      old ? { ...old, userVote: newVote, score: old.score + (newVote - old.userVote) } : old,
    )
    voteMutation.mutate(newVote)
  }

  if (postQuery.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  const post = postQuery.data
  if (postQuery.isError || !post) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-5xl flex-col items-center justify-center gap-2 px-4 text-center">
        <h1 className="text-xl font-semibold">Post not found</h1>
        <p className="text-sm text-muted-foreground">This post may have been removed.</p>
      </div>
    )
  }

  const community = communityQuery.data

  return (
    <div className="mx-auto mt-4 flex w-full max-w-5xl flex-col gap-6 px-4 pb-10 lg:flex-row">
      <div className="min-w-0 flex-1">
        <PostDetailCard
          post={post}
          communityHref={post.community ? `/r/${post.community.name}` : undefined}
          authorHref={post.author ? `/u/${post.author.username}` : undefined}
          voteDisabled={post.isLocked}
          onUpvote={() => {
            vote(1)
          }}
          onDownvote={() => {
            vote(-1)
          }}
          onShare={() => {
            void navigator.clipboard.writeText(window.location.href)
            toast.success("Link copied")
          }}
        />

        <Card className="mt-4">
          <CardContent className="py-10 text-center">
            <p className="text-sm font-medium text-muted-foreground">Comments coming soon</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Threaded discussion lands in a future update.
            </p>
          </CardContent>
        </Card>
      </div>

      {community ? (
        <aside className="w-full shrink-0 lg:w-80">
          <CommunityRightRail
            name={community.name}
            displayName={community.displayName}
            description={community.description}
            visibility={community.visibility}
            memberCount={community.memberCount}
            createdAt={community.createdAt}
            rules={community.rules}
            moderators={community.moderators.map((m) => ({
              userId: m.userId,
              username: m.username,
              avatarImageKey: m.avatarImageKey,
            }))}
          />
        </aside>
      ) : null}
    </div>
  )
}
