import { buttonVariants } from "@ui/base/ui/button"
import { ProfileHeader } from "@ui/seo-shared/profile/ProfileHeader"
import { fetchUser } from "@lib/dao/user/fetch"
import { db } from "@template-nextjs/db"
import Link from "next/link"
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
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
          <Link href="/" className="text-lg font-bold text-primary">
            ReadIt
          </Link>
          <div className="ml-auto">
            <Link href="/login" className={buttonVariants({ size: "sm" })}>
              Log In
            </Link>
          </div>
        </div>
      </header>
      <ProfileHeader
        user={{
          username: user.username,
          displayName: user.displayName,
          about: user.about,
          avatarUrl: null,
          bannerUrl: null,
          postKarma: user.postKarma,
          commentKarma: user.commentKarma,
          createdAt: user.createdAt,
        }}
      />
    </div>
  )
}
