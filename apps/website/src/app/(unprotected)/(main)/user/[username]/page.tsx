import { AnonProfileOverview, type AnonOverviewItem } from "@website/components/AnonProfileOverview"
import { loadProfileOverview } from "@website/lib/feed-ssr"
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
  const overview = await loadProfileOverview(user.id, session?.user.id ?? null)

  // Map the merged DAO items into presentational shapes, computing permalinks.
  const items: AnonOverviewItem[] = overview.map((item) =>
    item.kind === "post"
      ? { kind: "post", post: item.post }
      : {
          kind: "comment",
          comment: {
            id: item.comment.id,
            bodyMd: item.comment.bodyMd,
            score: item.comment.score,
            isDeleted: item.comment.isDeleted,
            createdAt: item.comment.createdAt,
            editedAt: item.comment.editedAt,
            post: {
              title: item.comment.post.title,
              href: item.comment.post.community
                ? `/r/${item.comment.post.community.name}/comments/${item.comment.post.id}?comment=${item.comment.id}`
                : undefined,
              community: item.comment.post.community
                ? {
                    name: item.comment.post.community.name,
                    href: `/r/${item.comment.post.community.name}`,
                  }
                : null,
            },
          },
        },
  )

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
      >
        {items.length === 0 ? (
          <div className="rounded-lg border bg-card p-10 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              u/{user.username} hasn&apos;t posted or commented yet
            </p>
          </div>
        ) : (
          <AnonProfileOverview items={items} />
        )}
      </ProfileHeader>
    </div>
  )
}
