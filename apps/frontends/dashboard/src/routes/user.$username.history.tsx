import { useQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { buttonVariants } from "@ui/base/ui/button"
import { ProfileHeader } from "@ui/seo-shared/profile/ProfileHeader"
import { HistoryTab } from "@frontends/dashboard/components/profile/HistoryTab"
import { mediaUrl } from "@frontends/dashboard/lib/mediaUrl"
import {
  getApiV1UserByUsernameByUsernameOptions,
  getApiV1UserMeOptions,
} from "@lib/api-client/generated/@tanstack/react-query.gen"

export const Route = createFileRoute("/user/$username/history")({
  component: HistoryPage,
})

function HistoryPage() {
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

  // History is private: only the owner can see their own recently viewed posts.
  const isOwnProfile = me?.username.toLowerCase() === data.username.toLowerCase()
  if (!isOwnProfile) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-5xl flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-xl font-semibold">This page is private</h1>
        <p className="text-sm text-muted-foreground">
          Only u/{data.username} can view their history.
        </p>
        <Link
          to="/user/$username"
          params={{ username: data.username }}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Back to profile
        </Link>
      </div>
    )
  }

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
          <Link to="/settings" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Edit profile
          </Link>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">History</h2>
            <Link
              to="/user/$username"
              params={{ username: data.username }}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Back to profile
            </Link>
          </div>
          <HistoryTab />
        </div>
      </ProfileHeader>
    </div>
  )
}
