import { useQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { buttonVariants } from "@ui/base/ui/button"
import { ProfileHeader } from "@ui/seo-shared/profile/ProfileHeader"
import { PostFeed } from "@frontends/dashboard/components/PostFeed"
import { mediaUrl } from "@frontends/dashboard/lib/mediaUrl"
import {
  getApiV1UserByUsernameByUsernameOptions,
  getApiV1UserMeOptions,
} from "@lib/api-client/generated/@tanstack/react-query.gen"

export const Route = createFileRoute("/u/$username")({
  component: ProfilePage,
})

function ProfilePage() {
  const { username } = Route.useParams()
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
          ) : null
        }
      />
      <div className="mx-auto mt-4 w-full max-w-3xl px-4">
        <PostFeed
          source={{ kind: "profile", username: data.username }}
          sorts={PROFILE_SORTS}
          defaultSort="new"
          showCommunity
          permalinkFor={() => `/u/${data.username}`}
          emptyTitle="No posts yet"
          emptyDescription={`u/${data.username} hasn't posted to their profile yet.`}
        />
      </div>
    </div>
  )
}

const PROFILE_SORTS = [
  { value: "new", label: "New" },
  { value: "top", label: "Top" },
  { value: "hot", label: "Hot" },
]
