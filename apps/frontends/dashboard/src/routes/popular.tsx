import { createFileRoute } from "@tanstack/react-router"
import { PostFeed, type FeedPost } from "@frontends/dashboard/components/PostFeed"

export const Route = createFileRoute("/popular")({
  component: PopularPage,
})

const POPULAR_SORTS = [
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

function PopularPage() {
  return (
    <div className="mx-auto mt-4 w-full max-w-3xl px-4">
      <h1 className="mb-3 text-xl font-bold">Popular posts</h1>
      <PostFeed
        showJoin
        source={{ kind: "popular" }}
        sorts={POPULAR_SORTS}
        defaultSort="hot"
        permalinkFor={permalinkFor}
        emptyTitle="Nothing trending yet"
        emptyDescription="Popular posts across ReadIt will show up here."
      />
    </div>
  )
}
