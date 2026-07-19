import { AnonCommentSection } from "@website/components/AnonCommentSection"
import { AnonPostDetail } from "@website/components/AnonPostDetail"
import { getCurrentSession } from "@website/lib/auth"
import type { CommentSortValue } from "@ui/seo-shared/comment/types"
import { fetchComment, ROOT_PAGE_SIZE } from "@lib/dao/comment/fetch"
import { processComments } from "@lib/dao/comment/processComment"
import { fetchCommunity } from "@lib/dao/community/fetch"
import { fetchPost } from "@lib/dao/post/fetch"
import { processPosts } from "@lib/dao/post/processPost"
import { fetchUser } from "@lib/dao/user/fetch"
import { db } from "@template-nextjs/db"
import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; postId: string }>
}): Promise<Metadata> {
  const { username, postId } = await params
  const post = await fetchPost(db).getOne(postId, ["title", "bodyMd"])
  if (!post) {
    return { title: "Post not found" }
  }
  const title = `${post.title} : u/${username}`
  const description = post.bodyMd?.slice(0, 200) ?? `A post by u/${username} on ReadIt.`
  return { title, description, openGraph: { title, description } }
}

const COMMENT_SORTS: CommentSortValue[] = ["best", "top", "new", "old", "controversial"]

function asCommentSort(value: unknown): CommentSortValue | undefined {
  return typeof value === "string" && (COMMENT_SORTS as string[]).includes(value)
    ? (value as CommentSortValue)
    : undefined
}

export default async function ProfilePostDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string; postId: string; slug?: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { username, postId } = await params
  const query = await searchParams

  const user = await fetchUser(db).getOneByUsername(username, ["id", "username"])
  if (!user) {
    notFound()
  }

  const [raw, meta] = await Promise.all([
    fetchPost(db).getRawById(postId),
    fetchPost(db).getOne(postId, ["removedAt", "communityId", "profileUserId"]),
  ])
  if (!raw || !meta || meta.removedAt !== null) {
    notFound()
  }
  if (meta.communityId !== null) {
    // A community post reached via a /user/... URL redirects to its canonical
    // community permalink.
    const community = await fetchCommunity(db).getOne(meta.communityId, ["name"])
    if (!community) notFound()
    redirect(`/r/${community.name}/comments/${postId}`)
  }
  if (meta.profileUserId !== user.id) {
    notFound()
  }

  const session = await getCurrentSession()
  const [post] = await processPosts(db, [raw], session?.user.id ?? null)

  const viewerId = session?.user.id ?? null
  const sort = asCommentSort(query.sort) ?? "best"
  const focusCommentId = typeof query.comment === "string" ? query.comment : undefined
  const offset = typeof query.offset === "string" ? Math.max(0, Number(query.offset) || 0) : 0

  let commentNodes: Awaited<ReturnType<typeof processComments>> = []
  let commentAncestors: Awaited<ReturnType<typeof processComments>> = []
  let hasMoreRoots = false
  if (focusCommentId) {
    const subtree = await fetchComment(db).getSubtreeWithAncestors({
      commentId: focusCommentId,
      sort,
    })
    if (subtree && subtree.focus.postId === postId) {
      commentNodes = await processComments(db, [subtree.focus, ...subtree.rows], viewerId)
      commentAncestors = await processComments(db, subtree.ancestors, viewerId)
    }
  } else {
    const page = await fetchComment(db).getTreePage({ postId, sort, offset })
    commentNodes = await processComments(db, page.rows, viewerId)
    hasMoreRoots = page.hasMore
  }

  return (
    <div className="mx-auto mt-4 flex w-full max-w-5xl flex-col gap-6 px-4 pb-10 lg:flex-row">
      <div className="min-w-0 flex-1">
        <AnonPostDetail
          post={post}
          authorHref={post.author ? `/user/${post.author.username}` : undefined}
        />
        <AnonCommentSection
          basePath={`/user/${username}/comments/${postId}`}
          sort={sort}
          nodes={commentNodes}
          ancestors={commentAncestors}
          focusCommentId={focusCommentId}
          commentCount={post.commentCount}
          hasMoreRoots={hasMoreRoots}
          nextOffset={offset + ROOT_PAGE_SIZE}
          locked={post.isLocked}
          postAuthorId={post.author?.id}
        />
      </div>
    </div>
  )
}
