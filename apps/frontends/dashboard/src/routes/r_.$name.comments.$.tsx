import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, type ReactElement, type ReactNode } from "react"
import { CommunityRightRail } from "@ui/seo-shared/community/CommunityRightRail"
import { LegalFooter } from "@ui/seo-shared/LegalFooter"
import { PostDetailCard } from "@ui/seo-shared/post/PostDetailCard"
import type { CommentSortValue } from "@ui/seo-shared/comment/types"
import { CommentSection } from "@frontends/dashboard/components/CommentSection"
import { PostCommentSearch } from "@frontends/dashboard/components/PostCommentSearch"
import { PostActionsMenu } from "@frontends/dashboard/components/PostActionsMenu"
import { PostShareMenu } from "@frontends/dashboard/components/PostShareMenu"
import {
  CommunityLinkHoverCard,
  UserLinkHoverCard,
} from "@frontends/dashboard/components/PostHoverCards"
import {
  getApiV1CommunityByNameOptions,
  getApiV1PostByIdOptions,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import { putApiV1PostVoteByPostId } from "@lib/api-client/generated/sdk.gen"
import { mediaUrl } from "@frontends/dashboard/lib/mediaUrl"
import { toast } from "sonner"

const COMMENT_SORTS: CommentSortValue[] = ["best", "top", "new", "old", "controversial"]

function asCommentSort(value: unknown): CommentSortValue | undefined {
  return typeof value === "string" && (COMMENT_SORTS as string[]).includes(value)
    ? (value as CommentSortValue)
    : undefined
}

function wrapCommunityLink(link: ReactElement, communityName: string): ReactNode {
  return <CommunityLinkHoverCard name={communityName}>{link}</CommunityLinkHoverCard>
}

function wrapAuthorLink(link: ReactElement, username: string): ReactNode {
  return <UserLinkHoverCard username={username}>{link}</UserLinkHoverCard>
}

type CommentSearch = { sort?: CommentSortValue; comment?: string }

export const Route = createFileRoute("/r_/$name/comments/$")({
  validateSearch: (search: Record<string, unknown>): CommentSearch => ({
    sort: asCommentSort(search.sort),
    comment: typeof search.comment === "string" ? search.comment : undefined,
  }),
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
  // Splat route: the URL is /r/:name/comments/:id[/:slug]. The id is the first
  // splat segment; any trailing slug is cosmetic and ignored for lookup.
  const { name, _splat } = Route.useParams()
  const postId = (_splat ?? "").split("/")[0]
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
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

  // M17c: the title-slug in the URL is cosmetic — the post is always fetched by
  // id. Once the post loads, append/replace its canonical slug onto the URL with
  // a history REPLACE (never a push) so the back button still leaves the post.
  // TODO(m17-backend): `slug` isn't on the generated post-by-id type yet; this
  // reads it defensively and no-ops until the field is generated. It also needs
  // a trailing-slug catch-all route so a slugged URL resolves the post by id on
  // reload/direct navigation (the current route matches only .../$postId).
  const postSlug = (postQuery.data as { slug?: string } | undefined)?.slug
  useEffect(() => {
    if (typeof window === "undefined" || !postSlug) return
    const canonicalPath = `/r/${name}/comments/${postId}/${postSlug}`
    if (window.location.pathname === canonicalPath) return
    window.history.replaceState(
      window.history.state,
      "",
      canonicalPath + window.location.search + window.location.hash,
    )
  }, [postSlug, name, postId])

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
  const sort: CommentSortValue =
    search.sort ?? asCommentSort(community?.defaultCommentSort) ?? "best"

  return (
    <div className="mx-auto mt-4 flex w-full max-w-5xl flex-col gap-6 px-4 pb-10 lg:flex-row">
      <div className="min-w-0 flex-1">
        <PostDetailCard
          post={{
            ...post,
            // Insights (view count) are author-only; the generated response still
            // sends viewCount to everyone, so gate it here until the backend does.
            // TODO(m17-backend): send author-only `viewCount` on the post serializer.
            viewCount: post.isAuthor ? post.viewCount : undefined,
            community: post.community
              ? { ...post.community, iconImageKey: mediaUrl(post.community.iconImageKey) }
              : null,
          }}
          insightsHref={`/poststats/${postId}`}
          communityHref={post.community ? `/r/${post.community.name}` : undefined}
          authorHref={post.author ? `/user/${post.author.username}` : undefined}
          onBack={() => {
            window.history.back()
          }}
          wrapCommunityLink={wrapCommunityLink}
          wrapAuthorLink={wrapAuthorLink}
          voteDisabled={post.isLocked}
          onUpvote={() => {
            vote(1)
          }}
          onDownvote={() => {
            vote(-1)
          }}
          shareSlot={
            <PostShareMenu
              post={{
                id: post.id,
                title: post.title,
                community: post.community ? { name: post.community.name } : null,
              }}
              permalink={`/r/${name}/comments/${postId}`}
            />
          }
          menuSlot={
            <PostActionsMenu
              post={{
                id: post.id,
                type: post.type,
                bodyMd: post.bodyMd,
                isNsfw: post.isNsfw,
                isSpoiler: post.isSpoiler,
                isOc: post.isOc,
                isAuthor: post.isAuthor,
                author: post.author ? { username: post.author.username } : null,
                community: post.community
                  ? { id: post.community.id, name: post.community.name }
                  : null,
                flair: post.flair ? { id: post.flair.id } : null,
              }}
              onHidden={() => {
                void navigate({ to: "/r/$name", params: { name } })
              }}
              onDeleted={() => {
                void navigate({ to: "/r/$name", params: { name } })
              }}
              onEdited={() => {
                void queryClient.invalidateQueries({ queryKey: postKey })
              }}
            />
          }
        />

        <PostCommentSearch postId={postId} communityName={name} />

        <CommentSection
          postId={postId}
          communityName={name}
          sort={sort}
          focusCommentId={search.comment}
          commentCount={post.commentCount}
          locked={post.isLocked}
          onSortChange={(next) => {
            void navigate({ search: (prev) => ({ ...prev, sort: next }), replace: true })
          }}
          onExitPermalink={() => {
            void navigate({ search: (prev) => ({ ...prev, comment: undefined }), replace: true })
          }}
        />
      </div>

      {community ? (
        <aside className="flex w-full shrink-0 flex-col gap-4 lg:sticky lg:top-[4.5rem] lg:max-h-[calc(100vh-4.5rem)] lg:w-80 lg:self-start lg:overflow-y-auto">
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
          <LegalFooter />
        </aside>
      ) : null}
    </div>
  )
}
