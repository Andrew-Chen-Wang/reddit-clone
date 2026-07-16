import { Avatar, AvatarFallback, AvatarImage } from "@ui/base/ui/avatar"
import { Card, CardContent } from "@ui/base/ui/card"
import { CakeIcon } from "lucide-react"
import type { ReactNode } from "react"
import { formatCompactNumber } from "@ui/seo-shared/format-number"

export type ProfileHeaderUser = {
  username: string
  displayName: string | null
  about: string | null
  avatarUrl: string | null
  bannerUrl: string | null
  postKarma: number
  commentKarma: number
  createdAt: string | Date
}

export type ProfileHeaderProps = {
  user: ProfileHeaderUser
  action?: ReactNode
  /** Extra right-sidebar cards rendered below the Karma card (moderating, social, settings). */
  sidebarExtra?: ReactNode
  /** Main-column content (tabs + feed) rendered beside the profile info card. */
  children?: ReactNode
}

function formatCakeDay(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function ProfileHeader({ user, action, sidebarExtra, children }: ProfileHeaderProps) {
  const name = user.displayName ?? user.username
  const initial = name.charAt(0).toUpperCase()
  const totalKarma = user.postKarma + user.commentKarma

  return (
    <div className="mx-auto w-full max-w-6xl px-4">
      <div className="h-16 w-full overflow-hidden rounded-b-lg bg-gradient-to-r from-primary/30 to-primary/10 sm:h-24">
        {user.bannerUrl ? (
          // oxlint-disable-next-line no-img-element
          <img src={user.bannerUrl} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>

      <div className="-mt-8 flex items-end gap-4 px-2">
        <Avatar className="size-16 border-4 border-background sm:size-20">
          {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={name} /> : null}
          <AvatarFallback className="text-2xl">{initial}</AvatarFallback>
        </Avatar>
        <div className="flex flex-1 items-center justify-between gap-4 pb-1">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold">{name}</h1>
            <p className="truncate text-sm text-muted-foreground">u/{user.username}</p>
          </div>
          {action}
        </div>
      </div>

      {user.about ? <p className="mt-3 px-2 text-sm text-foreground/90">{user.about}</p> : null}

      <div className="mt-6 flex flex-col gap-6 lg:flex-row-reverse">
        <aside className={`flex w-full shrink-0 flex-col gap-4${children ? " lg:w-72" : ""}`}>
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Karma
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-semibold">{formatCompactNumber(totalKarma)}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{formatCompactNumber(user.postKarma)}</p>
                    <p className="text-xs text-muted-foreground">Post</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold">
                      {formatCompactNumber(user.commentKarma)}
                    </p>
                    <p className="text-xs text-muted-foreground">Comment</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CakeIcon className="size-4" />
                <span>Cake day</span>
                <span className="ml-auto font-medium text-foreground">
                  {formatCakeDay(user.createdAt)}
                </span>
              </div>
            </CardContent>
          </Card>
          {sidebarExtra}
        </aside>

        {children ? <div className="min-w-0 flex-1">{children}</div> : null}
      </div>
    </div>
  )
}
