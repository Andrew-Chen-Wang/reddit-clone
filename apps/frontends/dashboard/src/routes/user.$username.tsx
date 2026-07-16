import { useQuery } from "@tanstack/react-query"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { buttonVariants } from "@ui/base/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ui/base/ui/tabs"
import { ProfileHeader } from "@ui/seo-shared/profile/ProfileHeader"
import { PostFeed, type FeedPost } from "@frontends/dashboard/components/PostFeed"
import { CommentWithPostList } from "@frontends/dashboard/components/CommentWithPostList"
import { EngagementPostList } from "@frontends/dashboard/components/EngagementPostList"
import { ProfileActions } from "@frontends/dashboard/components/ProfileActions"
import { OverviewFeed } from "@frontends/dashboard/components/profile/OverviewFeed"
import { HistoryTab } from "@frontends/dashboard/components/profile/HistoryTab"
import { FeedViewMenu } from "@frontends/dashboard/components/profile/FeedViewMenu"
import { PROFILE_SORTS } from "@frontends/dashboard/components/profile/FeedSortMenu"
import { useFeedView, type ViewMode } from "@frontends/dashboard/components/profile/useFeedView"
import { mediaUrl } from "@frontends/dashboard/lib/mediaUrl"
import {
  getApiV1UserByUsernameByUsernameComments,
  getApiV1UserMeDownvoted,
  getApiV1UserMeHidden,
  getApiV1UserMeSaved,
  getApiV1UserMeUpvoted,
} from "@lib/api-client/generated/sdk.gen"
import {
  getApiV1UserByUsernameByUsernameOptions,
  getApiV1UserMeOptions,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
const PROFILE_TABS = [
  "overview",
  "posts",
  "comments",
  "saved",
  "history",
  "hidden",
  "upvoted",
  "downvoted",
] as const
type ProfileTab = (typeof PROFILE_TABS)[number]

const PUBLIC_TABS: ProfileTab[] = ["overview", "posts", "comments"]

type ProfileSearch = { tab?: ProfileTab }

export const Route = createFileRoute("/user/$username")({
  validateSearch: (search: Record<string, unknown>): ProfileSearch => ({
    tab: PROFILE_TABS.includes(search.tab as ProfileTab) ? (search.tab as ProfileTab) : undefined,
  }),
  component: ProfilePage,
})

function postPermalink(post: FeedPost): string {
  return post.community
    ? `/r/${post.community.name}/comments/${post.id}`
    : `/user/${post.author?.username ?? ""}`
}

/** A right-aligned toolbar carrying just the card/compact view toggle. */
function ViewToolbar({ view, onChange }: { view: ViewMode; onChange: (next: ViewMode) => void }) {
  return (
    <div className="flex items-center">
      <div className="ml-auto">
        <FeedViewMenu view={view} onChange={onChange} />
      </div>
    </div>
  )
}

function PostsTab({ username }: { username: string }) {
  return (
    <PostFeed
      source={{ kind: "profile", username }}
      sorts={PROFILE_SORTS}
      defaultSort="new"
      showCommunity
      permalinkFor={postPermalink}
      emptyTitle="No posts yet"
      emptyDescription={`u/${username} hasn't posted in any community yet.`}
    />
  )
}

function CommentsTab({ username }: { username: string }) {
  const { view, setView } = useFeedView()
  return (
    <div className="flex flex-col gap-3">
      <ViewToolbar view={view} onChange={setView} />
      <CommentWithPostList
        queryKey={["profile-comments", username]}
        compact={view === "compact"}
        fetchPage={async (cursor) => {
          const { data } = await getApiV1UserByUsernameByUsernameComments({
            path: { username },
            query: { cursor },
            throwOnError: true,
          })
          return { comments: data.data, nextCursor: data.nextCursor }
        }}
        emptyTitle="No comments yet"
        emptyDescription={`u/${username} hasn't commented yet.`}
      />
    </div>
  )
}

function SavedTab() {
  const { view, setView } = useFeedView()
  return (
    <div className="flex flex-col gap-8">
      <ViewToolbar view={view} onChange={setView} />
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Saved posts</h2>
        <EngagementPostList
          queryKey={["me", "saved", "posts"]}
          view={view}
          fetchPage={async (cursor) => {
            const { data } = await getApiV1UserMeSaved({
              query: { type: "posts", cursor },
              throwOnError: true,
            })
            return { posts: data.posts, nextCursor: data.nextCursor }
          }}
          permalinkFor={postPermalink}
          emptyTitle="No saved posts"
          emptyDescription="Posts you save appear here."
          menuInitial={{ saved: true }}
          removeTriggers={{ unsave: true }}
        />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Saved comments</h2>
        <CommentWithPostList
          queryKey={["me", "saved", "comments"]}
          compact={view === "compact"}
          fetchPage={async (cursor) => {
            const { data } = await getApiV1UserMeSaved({
              query: { type: "comments", cursor },
              throwOnError: true,
            })
            return { comments: data.comments, nextCursor: data.nextCursor }
          }}
          emptyTitle="No saved comments"
          emptyDescription="Comments you save appear here."
        />
      </section>
    </div>
  )
}

function HiddenTab() {
  const { view, setView } = useFeedView()
  return (
    <div className="flex flex-col gap-3">
      <ViewToolbar view={view} onChange={setView} />
      <EngagementPostList
        queryKey={["me", "hidden"]}
        view={view}
        fetchPage={async (cursor) => {
          const { data } = await getApiV1UserMeHidden({ query: { cursor }, throwOnError: true })
          return { posts: data.data, nextCursor: data.nextCursor }
        }}
        permalinkFor={postPermalink}
        emptyTitle="Nothing hidden"
        emptyDescription="Posts you hide appear here."
        menuInitial={{ hidden: true }}
        removeTriggers={{ unhide: true }}
      />
    </div>
  )
}

function UpvotedTab() {
  const { view, setView } = useFeedView()
  return (
    <div className="flex flex-col gap-3">
      <ViewToolbar view={view} onChange={setView} />
      <EngagementPostList
        queryKey={["me", "upvoted"]}
        view={view}
        fetchPage={async (cursor) => {
          const { data } = await getApiV1UserMeUpvoted({ query: { cursor }, throwOnError: true })
          return { posts: data.data, nextCursor: data.nextCursor }
        }}
        permalinkFor={postPermalink}
        emptyTitle="No upvoted posts"
        emptyDescription="Posts you upvote appear here."
      />
    </div>
  )
}

function DownvotedTab() {
  const { view, setView } = useFeedView()
  return (
    <div className="flex flex-col gap-3">
      <ViewToolbar view={view} onChange={setView} />
      <EngagementPostList
        queryKey={["me", "downvoted"]}
        view={view}
        fetchPage={async (cursor) => {
          const { data } = await getApiV1UserMeDownvoted({ query: { cursor }, throwOnError: true })
          return { posts: data.data, nextCursor: data.nextCursor }
        }}
        permalinkFor={postPermalink}
        emptyTitle="No downvoted posts"
        emptyDescription="Posts you downvote appear here."
      />
    </div>
  )
}

function ProfilePage() {
  const { username } = Route.useParams()
  const { tab } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { data: me } = useQuery(getApiV1UserMeOptions())
  const { data, isLoading, isError } = useQuery(
    getApiV1UserByUsernameByUsernameOptions({ path: { username } }),
  )

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-5xl flex-col items-center justify-center gap-2 px-4 text-center">
        <h1 className="text-xl font-semibold">User not found</h1>
        <p className="text-sm text-muted-foreground">There is no ReadIt user with that username.</p>
      </div>
    )
  }

  const isOwnProfile = me?.username.toLowerCase() === data.username.toLowerCase()
  const activeTab: ProfileTab = tab ?? "overview"
  const visibleTabs = isOwnProfile ? PROFILE_TABS : PUBLIC_TABS

  return (
    <div className="pb-10">
      <ProfileHeader
        user={{
          username: data.username,
          displayName: data.displayName,
          about: data.about,
          avatarUrl: mediaUrl(data.avatarImageKey),
          bannerUrl: mediaUrl(data.bannerImageKey),
          postKarma: data.postKarma,
          commentKarma: data.commentKarma,
          createdAt: data.createdAt,
        }}
        action={
          isOwnProfile ? (
            <Link to="/settings" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Edit profile
            </Link>
          ) : (
            <ProfileActions username={data.username} />
          )
        }
      >
        <Tabs
          value={activeTab}
          onValueChange={(next) => {
            void navigate({ search: { tab: next as ProfileTab }, replace: true })
          }}
        >
          <TabsList className="mb-4 flex-wrap">
            {visibleTabs.map((t) => (
              <TabsTrigger key={t} value={t} className="capitalize">
                {t}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview">
            <OverviewFeed username={data.username} />
          </TabsContent>
          <TabsContent value="posts">
            <PostsTab username={data.username} />
          </TabsContent>
          <TabsContent value="comments">
            <CommentsTab username={data.username} />
          </TabsContent>
          {isOwnProfile ? (
            <>
              <TabsContent value="saved">
                <SavedTab />
              </TabsContent>
              <TabsContent value="history">
                <HistoryTab />
              </TabsContent>
              <TabsContent value="hidden">
                <HiddenTab />
              </TabsContent>
              <TabsContent value="upvoted">
                <UpvotedTab />
              </TabsContent>
              <TabsContent value="downvoted">
                <DownvotedTab />
              </TabsContent>
            </>
          ) : null}
        </Tabs>
      </ProfileHeader>
    </div>
  )
}
