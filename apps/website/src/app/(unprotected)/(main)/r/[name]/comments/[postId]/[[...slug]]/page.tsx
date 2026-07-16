import { AnonPostDetail } from "@website/components/AnonPostDetail"
import { getCurrentSession } from "@website/lib/auth"
import { Card, CardContent } from "@ui/base/ui/card"
import { CommunityRightRail } from "@ui/seo-shared/community/CommunityRightRail"
import { fetchCommunity } from "@lib/dao/community/fetch"
import { fetchCommunityModerator } from "@lib/dao/communityModerator/fetch"
import { fetchCommunityRule } from "@lib/dao/communityRule/fetch"
import { fetchPost } from "@lib/dao/post/fetch"
import { processPosts } from "@lib/dao/post/processPost"
import { db } from "@template-nextjs/db"
import { notFound } from "next/navigation"

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ name: string; postId: string; slug?: string[] }>
}) {
  const { name, postId } = await params

  const community = await fetchCommunity(db).getOneByName(name, [
    "id",
    "name",
    "displayName",
    "description",
    "visibility",
    "memberCount",
    "createdAt",
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

  return (
    <div className="mx-auto mt-4 flex w-full max-w-5xl flex-col gap-6 px-4 pb-10 lg:flex-row">
      <div className="min-w-0 flex-1">
        <AnonPostDetail
          post={post}
          communityHref={`/r/${community.name}`}
          authorHref={post.author ? `/u/${post.author.username}` : undefined}
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

      <aside className="w-full shrink-0 lg:w-80">
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
      </aside>
    </div>
  )
}
