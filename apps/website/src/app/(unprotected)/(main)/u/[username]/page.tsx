import { ProfileHeader } from "@ui/seo-shared/profile/ProfileHeader"
import { fetchUser } from "@lib/dao/user/fetch"
import { db } from "@template-nextjs/db"
import { mediaUrl } from "@website/lib/mediaUrl"
import { notFound } from "next/navigation"

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const user = await fetchUser(db).getOneByUsername(username, [
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

  return (
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
  )
}
