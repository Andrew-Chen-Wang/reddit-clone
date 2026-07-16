import { AnonFeed } from "@website/components/AnonFeed"
import { loadProfileFeed } from "@website/lib/feed-ssr"
import { getCurrentSession } from "@website/lib/auth"
import { ProfileHeader } from "@ui/seo-shared/profile/ProfileHeader"
import { fetchUser } from "@lib/dao/user/fetch"
import { db } from "@template-nextjs/db"
import { mediaUrl } from "@website/lib/mediaUrl"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>
}): Promise<Metadata> {
  const { username } = await params
  const user = await fetchUser(db).getOneByUsername(username, ["username", "displayName", "about"])
  if (!user) {
    return { title: "User not found" }
  }
  const title = `${user.displayName ?? `u/${user.username}`} (u/${user.username})`
  const description = user.about ?? `See posts and comments from u/${user.username} on ReadIt.`
  return {
    title,
    description,
    openGraph: { title, description },
  }
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const user = await fetchUser(db).getOneByUsername(username, [
    "id",
    "username",
    "displayName",
    "about",
    "avatarImageKey",
    "bannerImageKey",
    "postKarma",
    "commentKarma",
    "createdAt",
  ])

  if (!user) {
    notFound()
  }

  const session = await getCurrentSession()
  const feed = await loadProfileFeed(user.id, session?.user.id ?? null)

  return (
    <div className="pb-10">
      <ProfileHeader
        user={{
          username: user.username,
          displayName: user.displayName,
          about: user.about,
          avatarUrl: mediaUrl(user.avatarImageKey),
          bannerUrl: mediaUrl(user.bannerImageKey),
          postKarma: user.postKarma,
          commentKarma: user.commentKarma,
          createdAt: user.createdAt,
        }}
      />

      <div className="mx-auto mt-4 w-full max-w-3xl px-4">
        {feed.posts.length === 0 ? (
          <div className="rounded-lg border bg-card p-10 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              u/{user.username} hasn&apos;t posted yet
            </p>
          </div>
        ) : (
          <AnonFeed
            source={{ kind: "profile", username: user.username }}
            sort="new"
            t="all"
            initialPosts={feed.posts}
            initialCursor={feed.initialCursor}
            showCommunity
          />
        )}
      </div>
    </div>
  )
}
