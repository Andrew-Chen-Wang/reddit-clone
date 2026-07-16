import { AnonCommentSection } from "@website/components/AnonCommentSection"
import { AnonPostDetail } from "@website/components/AnonPostDetail"
import { getCurrentSession } from "@website/lib/auth"
import { CommunityRightRail } from "@ui/seo-shared/community/CommunityRightRail"
import { LegalFooter } from "@ui/seo-shared/LegalFooter"
import type { CommentSortValue } from "@ui/seo-shared/comment/types"
import { fetchComment, ROOT_PAGE_SIZE } from "@lib/dao/comment/fetch"
import { processComments } from "@lib/dao/comment/processComment"
import { fetchCommunity } from "@lib/dao/community/fetch"
import { fetchCommunityModerator } from "@lib/dao/communityModerator/fetch"
import { fetchCommunityRule } from "@lib/dao/communityRule/fetch"
import { fetchPost } from "@lib/dao/post/fetch"
import { processPosts } from "@lib/dao/post/processPost"
import { db } from "@template-nextjs/db"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string; postId: string }>
}): Promise<Metadata> {
  const { name, postId } = await params
  const post = await fetchPost(db).getOne(postId, ["title", "bodyMd"])
  if (!post) {
    return { title: "Post not found" }
  }
  const title = `${post.title} : r/${name}`
  const description = post.bodyMd?.slice(0, 200) ?? `Discussion in r/${name} on ReadIt.`
  return { title, description, openGraph: { title, description } }
}

const COMMENT_SORTS: CommentSortValue[] = ["best", "top", "new", "old", "controversial"]

function asCommentSort(value: unknown): CommentSortValue | undefined {
  return typeof value === "string" && (COMMENT_SORTS as string[]).includes(value)
    ? (value as CommentSortValue)
    : undefined
}

export default async function PostDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string; postId: string; slug?: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { name, postId } = await params
  const query = await searchParams

  const community = await fetchCommunity(db).getOneByName(name, [
    "id",
    "name",
    "displayName",
    "description",
    "visibility",
    "memberCount",
    "createdAt",
    "defaultCommentSort",
  ])
  if (!community || community.visibility === "private") {
    notFound()
  }

  const [raw, meta] = await Promise.all([
    fetchPost(db).getRawById(postId),
    fetchPost(db).getOne(postId, ["removedAt", "communityId"]),
  ])
  if (!raw || !meta || meta.removedAt !== null || meta.communityId !== community.id) {
    notFound()
  }

  const session = await getCurrentSession()
  const [post] = await processPosts(db, [raw], session?.user.id ?? null)

  const [rules, moderators] = await Promise.all([
    fetchCommunityRule(db).getManyForCommunity(community.id, [
      "id",
      "name",
      "description",
      "position",
    ]),
    fetchCommunityModerator(db).getManyForCommunity(community.id),
  ])

  const viewerId = session?.user.id ?? null
  const sort = asCommentSort(query.sort) ?? asCommentSort(community.defaultCommentSort) ?? "best"
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
          communityHref={`/r/${community.name}`}
          authorHref={post.author ? `/user/${post.author.username}` : undefined}
        />
        <AnonCommentSection
          postId={postId}
          communityName={community.name}
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

      <aside className="flex w-full shrink-0 flex-col gap-4 lg:sticky lg:top-[4.5rem] lg:max-h-[calc(100vh-4.5rem)] lg:w-80 lg:self-start lg:overflow-y-auto">
        <CommunityRightRail
          name={community.name}
          displayName={community.displayName}
          description={community.description}
          visibility={community.visibility}
          memberCount={community.memberCount}
          createdAt={community.createdAt}
          rules={rules}
          moderators={moderators.map((m) => ({
            userId: m.userId,
            username: m.username,
            avatarImageKey: m.avatarImageKey,
          }))}
        />
        <LegalFooter />
      </aside>
    </div>
  )
}
