import { AnonFeed } from "@website/components/AnonFeed"
import { FeedSortTabs } from "@website/components/FeedSortTabs"
import { loadCommunityFeed, normalizeSort } from "@website/lib/feed-ssr"
import { getCurrentSession } from "@website/lib/auth"
import { buttonVariants } from "@ui/base/ui/button"
import { CommunityHeader } from "@ui/seo-shared/community/CommunityHeader"
import { CommunityRightRail } from "@ui/seo-shared/community/CommunityRightRail"
import { fetchCommunity } from "@lib/dao/community/fetch"
import { fetchCommunityBookmark } from "@lib/dao/communityBookmark/fetch"
import { fetchCommunityModerator } from "@lib/dao/communityModerator/fetch"
import { fetchCommunityRelated } from "@lib/dao/communityRelated/fetch"
import { fetchCommunityRule } from "@lib/dao/communityRule/fetch"
import { fetchCommunityWidget } from "@lib/dao/communityWidget/fetch"
import { db } from "@template-nextjs/db"
import { mediaUrl } from "@website/lib/mediaUrl"
import Link from "next/link"
import { notFound } from "next/navigation"

const COMMUNITY_SORTS = [
  { value: "hot", label: "Hot" },
  { value: "new", label: "New" },
  { value: "top", label: "Top" },
  { value: "rising", label: "Rising" },
  { value: "controversial", label: "Controversial" },
]
const ALLOWED = ["hot", "new", "top", "rising", "controversial"] as const

export default async function CommunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>
  searchParams: Promise<{ sort?: string; t?: string }>
}) {
  const { name } = await params
  const { sort: sortParam, t } = await searchParams
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

  const sort = normalizeSort(sortParam, ALLOWED)
  const session = await getCurrentSession()

  const [rules, moderators, feed, bookmarks, widgets, related] = await Promise.all([
    fetchCommunityRule(db).getManyForCommunity(community.id, [
      "id",
      "name",
      "description",
      "position",
    ]),
    fetchCommunityModerator(db).getManyForCommunity(community.id),
    loadCommunityFeed(community.id, sort, t, session?.user.id ?? null),
    fetchCommunityBookmark(db).listForCommunity(community.id, ["id", "label", "url", "position"]),
    fetchCommunityWidget(db).listForCommunity(community.id, ["id", "title", "bodyMd", "position"]),
    fetchCommunityRelated(db).listForCommunity(community.id),
  ])

  return (
    <div className="pb-10">
      <CommunityHeader
        community={{
          name: community.name,
          displayName: community.displayName,
          iconUrl: mediaUrl(community.iconImageKey),
          bannerUrl: mediaUrl(community.bannerImageKey),
          memberCount: community.memberCount,
        }}
        joinSlot={
          <Link href="/login" className={buttonVariants({ size: "sm" })}>
            Join
          </Link>
        }
        createPostSlot={
          <Link href="/login" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Create Post
          </Link>
        }
      />

      <div className="mx-auto mt-4 flex w-full max-w-5xl flex-col gap-6 px-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="mb-3">
            <FeedSortTabs
              basePath={`/r/${community.name}`}
              current={sort}
              sorts={COMMUNITY_SORTS}
              t={t}
            />
          </div>
          {feed.posts.length === 0 ? (
            <div className="rounded-lg border bg-card p-10 text-center">
              <p className="text-sm font-medium text-muted-foreground">
                This community doesn&apos;t have any posts yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Be the first to share something with r/{community.name}.
              </p>
            </div>
          ) : (
            <AnonFeed
              source={{ kind: "community", name: community.name }}
              sort={sort}
              t={t ?? "day"}
              initialPosts={feed.posts}
              initialCursor={feed.initialCursor}
              showCommunity={false}
            />
          )}
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
            bookmarks={bookmarks}
            widgets={widgets}
            related={related.map((r) => ({
              id: r.id,
              name: r.name,
              displayName: r.displayName,
              iconUrl: mediaUrl(r.iconImageKey),
              memberCount: r.memberCount,
            }))}
          />
        </aside>
      </div>
    </div>
  )
}
