import { buttonVariants } from "@ui/base/ui/button"
import { CommunityHeader } from "@ui/seo-shared/community/CommunityHeader"
import { CommunityRightRail } from "@ui/seo-shared/community/CommunityRightRail"
import { fetchCommunity } from "@lib/dao/community/fetch"
import { fetchCommunityModerator } from "@lib/dao/communityModerator/fetch"
import { fetchCommunityRule } from "@lib/dao/communityRule/fetch"
import { db } from "@template-nextjs/db"
import Link from "next/link"
import { notFound } from "next/navigation"

export default async function CommunityPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const community = await fetchCommunity(db).getOneByName(name, [
    "id",
    "name",
    "displayName",
    "description",
    "visibility",
    "isNsfw",
    "iconImageKey",
    "bannerImageKey",
    "memberCount",
    "createdAt",
  ])

  // Anonymous visitors can never see private communities.
  if (!community || community.visibility === "private") {
    notFound()
  }

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
    <div className="pb-10">
      <CommunityHeader
        community={{
          name: community.name,
          displayName: community.displayName,
          iconUrl: null,
          bannerUrl: null,
          memberCount: community.memberCount,
        }}
        joinSlot={
          <Link href="/login" className={buttonVariants({ size: "sm" })}>
            Join
          </Link>
        }
        createPostSlot={
          <Link
            href="/login"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Create Post
          </Link>
        }
      />

      <div className="mx-auto mt-4 flex w-full max-w-5xl flex-col gap-6 px-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="rounded-lg border bg-card p-10 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              This community doesn&apos;t have any posts yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Be the first to share something with r/{community.name}.
            </p>
          </div>
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
    </div>
  )
}
