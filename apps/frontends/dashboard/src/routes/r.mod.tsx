import { createFileRoute } from "@tanstack/react-router"
import { ShieldHalf } from "lucide-react"
import { PostFeed, type FeedPost } from "@frontends/dashboard/components/PostFeed"

export const Route = createFileRoute("/r/mod")({
  component: ModFeedPage,
})

const MOD_SORTS = [
  { value: "hot", label: "Hot" },
  { value: "new", label: "New" },
  { value: "top", label: "Top" },
  { value: "rising", label: "Rising" },
  { value: "controversial", label: "Controversial" },
]

function permalinkFor(post: FeedPost): string {
  if (post.community) return `/r/${post.community.name}/comments/${post.id}`
  if (post.author) return `/user/${post.author.username}`
  return "/"
}

function ModFeedPage() {
  return (
    <div className="mx-auto mt-4 w-full max-w-3xl px-4">
      <div className="mb-3 flex items-center gap-2">
        <ShieldHalf className="size-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold">r/Mod</h1>
          <p className="text-sm text-muted-foreground">Posts from every community you moderate</p>
        </div>
      </div>
      <PostFeed
        showJoin={false}
        source={{ kind: "mod" }}
        sorts={MOD_SORTS}
        defaultSort="hot"
        permalinkFor={permalinkFor}
        emptyTitle="No posts to review"
        emptyDescription="Posts from the communities you moderate will show up here."
      />
    </div>
  )
}
