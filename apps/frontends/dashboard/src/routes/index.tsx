import { createFileRoute } from "@tanstack/react-router"
import { LegalFooter } from "@ui/seo-shared/LegalFooter"
import { PostFeed, type FeedPost } from "@frontends/dashboard/components/PostFeed"
import { RecentPostsRail } from "@frontends/dashboard/components/RecentPostsRail"
import { SuggestedCommunitiesRail } from "@frontends/dashboard/components/SuggestedCommunitiesRail"

export const Route = createFileRoute("/")({
  component: DashboardHome,
})

const HOME_SORTS = [
  { value: "best", label: "Best" },
  { value: "hot", label: "Hot" },
  { value: "new", label: "New" },
  { value: "top", label: "Top" },
  { value: "rising", label: "Rising" },
]

function permalinkFor(post: FeedPost): string {
  if (post.community) return `/r/${post.community.name}/comments/${post.id}`
  if (post.author) return `/user/${post.author.username}`
  return "/"
}

function DashboardHome() {
  return (
    <div className="mx-auto mt-4 flex w-full max-w-5xl flex-col gap-6 px-4 lg:flex-row">
      <div className="min-w-0 flex-1">
        <PostFeed
          showJoin
          source={{ kind: "home" }}
          sorts={HOME_SORTS}
          defaultSort="best"
          permalinkFor={permalinkFor}
          emptyTitle="Your home feed is empty"
          emptyDescription="Join some communities to see posts here."
        />
      </div>
      <aside className="flex w-full shrink-0 flex-col gap-4 lg:sticky lg:top-[4.5rem] lg:max-h-[calc(100vh-4.5rem)] lg:w-80 lg:self-start lg:overflow-y-auto">
        <SuggestedCommunitiesRail />
        <RecentPostsRail />
        <LegalFooter />
      </aside>
    </div>
  )
}
