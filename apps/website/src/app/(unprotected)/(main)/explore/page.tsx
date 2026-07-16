import { buttonVariants } from "@ui/base/ui/button"
import { cn } from "@ui/base/lib/utils"
import { CommunityCard } from "@ui/seo-shared/community/CommunityCard"
import { fetchCommunity } from "@lib/dao/community/fetch"
import { fetchTopic } from "@lib/dao/topic/fetch"
import { db } from "@template-nextjs/db"
import Link from "next/link"

const PAGE_SIZE = 6

type ExploreCommunity = {
  id: string
  name: string
  displayName: string | null
  description: string
  iconImageKey: string | null
  memberCount: number
  isNsfw: boolean
}

const COMMUNITY_FIELDS: [
  "id",
  "name",
  "displayName",
  "description",
  "iconImageKey",
  "memberCount",
  "isNsfw",
] = ["id", "name", "displayName", "description", "iconImageKey", "memberCount", "isNsfw"]

function TopicChips({
  topics,
  active,
}: {
  topics: { slug: string; name: string }[]
  active?: string
}) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
      <Link
        href="/explore"
        className={cn(
          buttonVariants({ variant: !active ? "default" : "outline", size: "sm" }),
          "shrink-0 rounded-full",
        )}
      >
        All
      </Link>
      {topics.map((t) => (
        <Link
          key={t.slug}
          href={`/explore?topic=${t.slug}`}
          className={cn(
            buttonVariants({ variant: active === t.slug ? "default" : "outline", size: "sm" }),
            "shrink-0 rounded-full",
          )}
        >
          {t.name}
        </Link>
      ))}
    </div>
  )
}

function CommunityGrid({ communities }: { communities: ExploreCommunity[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {communities.map((community) => (
        <CommunityCard
          key={community.id}
          community={{
            name: community.name,
            displayName: community.displayName,
            description: community.description,
            iconUrl: null,
            memberCount: community.memberCount,
          }}
          joinSlot={
            <Link href="/login" className={buttonVariants({ size: "sm" })}>
              Join
            </Link>
          }
        />
      ))}
    </div>
  )
}

export const metadata = { title: "Explore communities" }

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string; offset?: string }>
}) {
  const { topic: topicSlug, offset: offsetParam } = await searchParams
  const topics = await fetchTopic(db).getMany(["id", "name", "slug"])

  if (topicSlug) {
    const topic = topics.find((t) => t.slug === topicSlug)
    const offset = Math.max(0, Number.parseInt(offsetParam ?? "0", 10) || 0)
    const limit = offset + PAGE_SIZE
    const rows = topic
      ? ((await fetchCommunity(db).getManyByTopic(
          topic.id,
          COMMUNITY_FIELDS,
          limit + 1,
          0,
        )) as ExploreCommunity[])
      : []
    const hasMore = rows.length > limit
    const communities = rows.slice(0, limit)

    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-bold">Explore</h1>
        <TopicChips topics={topics} active={topicSlug} />
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-semibold">{topic?.name ?? "Topic"}</h2>
          {communities.length > 0 ? (
            <CommunityGrid communities={communities} />
          ) : (
            <p className="text-sm text-muted-foreground">No communities in this topic yet.</p>
          )}
          {hasMore ? (
            <div className="mt-4 flex justify-center">
              <Link
                href={`/explore?topic=${topicSlug}&offset=${offset + PAGE_SIZE}`}
                className={buttonVariants({ variant: "outline" })}
              >
                Show more
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  const sections = []
  for (const topic of topics) {
    const rows = (await fetchCommunity(db).getManyByTopic(
      topic.id,
      COMMUNITY_FIELDS,
      PAGE_SIZE + 1,
      0,
    )) as ExploreCommunity[]
    if (rows.length === 0) continue
    sections.push({
      topic,
      communities: rows.slice(0, PAGE_SIZE),
      hasMore: rows.length > PAGE_SIZE,
    })
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold">Explore</h1>
      <TopicChips topics={topics} />
      <div className="mt-6 flex flex-col gap-8">
        {sections.map(({ topic, communities, hasMore }) => (
          <section key={topic.id}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{topic.name}</h2>
              {hasMore ? (
                <Link
                  href={`/explore?topic=${topic.slug}`}
                  className="text-sm text-primary hover:underline"
                >
                  Show more
                </Link>
              ) : null}
            </div>
            <CommunityGrid communities={communities} />
          </section>
        ))}
        {sections.length === 0 ? (
          <p className="text-sm text-muted-foreground">No communities to explore yet.</p>
        ) : null}
      </div>
    </div>
  )
}
