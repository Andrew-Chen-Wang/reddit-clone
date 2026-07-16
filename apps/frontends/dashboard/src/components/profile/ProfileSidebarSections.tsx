import { Link } from "@tanstack/react-router"
import { buttonVariants } from "@ui/base/ui/button"
import { Card, CardContent } from "@ui/base/ui/card"
import { cn } from "@ui/base/lib/utils"
import { CommunityIcon } from "@ui/seo-shared/community/CommunityIcon"
import { formatCompactNumber } from "@ui/seo-shared/format-number"
import { Link2, Plus } from "lucide-react"

/** A community the profile user moderates (GET /v1/user/by-username/:username/moderating). */
export type ModeratedCommunity = {
  id: string
  name: string
  iconImageKey: string | null
  memberCount: number
}

/** A profile social link (GET /v1/user/by-username/:username/social-links). */
export type ProfileSocialLink = {
  id: string
  platform: string
  url: string
  label: string | null
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        {children}
      </CardContent>
    </Card>
  )
}

function ModeratingSection({ communities }: { communities: ModeratedCommunity[] }) {
  if (communities.length === 0) return null
  return (
    <SectionCard title="Moderating">
      <ul className="flex flex-col gap-3">
        {communities.map((c) => (
          <li key={c.id} className="flex items-center gap-2">
            <CommunityIcon name={c.name} iconUrl={c.iconImageKey} size="md" />
            <Link
              to="/r/$name"
              params={{ name: c.name }}
              className="min-w-0 flex-1 leading-tight hover:underline"
            >
              <span className="block truncate text-sm font-medium">r/{c.name}</span>
              <span className="block text-xs text-muted-foreground">
                {formatCompactNumber(c.memberCount)} members
              </span>
            </Link>
            {/* The moderating list carries no per-viewer membership flag, so this
                is a link into the community where Join/Joined lives. */}
            <Link
              to="/r/$name"
              params={{ name: c.name }}
              className={buttonVariants({ size: "sm" })}
            >
              View
            </Link>
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}

function SocialLinksSection({
  links,
  isOwnProfile,
}: {
  links: ProfileSocialLink[]
  isOwnProfile: boolean
}) {
  // Others' empty social links hide the whole section; the owner keeps the "Add" affordance.
  if (links.length === 0 && !isOwnProfile) return null
  return (
    <SectionCard title="Social Links">
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "rounded-full")}
          >
            <Link2 className="size-4" />
            {link.label ?? link.platform}
          </a>
        ))}
        {isOwnProfile ? (
          // TODO(m17): point at the social-link editor once settings gains that flow.
          <Link
            to="/settings"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}
          >
            <Plus className="size-4" />
            Add Social Link
          </Link>
        ) : null}
      </div>
    </SectionCard>
  )
}

const SETTINGS_ROWS = [
  { label: "Profile", to: "/settings" },
  { label: "Avatar", to: "/settings" },
  { label: "Post flair", to: "/settings" },
  { label: "Mod Tools", to: "/settings" },
] as const

function SettingsSection() {
  return (
    <SectionCard title="Settings">
      <ul className="flex flex-col gap-2">
        {SETTINGS_ROWS.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-2 text-sm">
            <span>{row.label}</span>
            <Link to={row.to} className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Update
            </Link>
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}

/**
 * Extra profile right-sidebar cards below the Karma card: communities the user
 * moderates, their social links, and (own profile only) quick settings rows.
 *
 * TODO(m17-backend): `moderating` and `socialLinks` come from new endpoints that
 * aren't in the generated client yet — GET /v1/user/by-username/:username/moderating
 * and the social-links endpoint. The route currently passes empty arrays; wire the
 * generated hooks once regenerated.
 */
export function ProfileSidebarSections({
  moderating,
  socialLinks,
  isOwnProfile,
}: {
  moderating: ModeratedCommunity[]
  socialLinks: ProfileSocialLink[]
  isOwnProfile: boolean
}) {
  return (
    <>
      <ModeratingSection communities={moderating} />
      <SocialLinksSection links={socialLinks} isOwnProfile={isOwnProfile} />
      {isOwnProfile ? <SettingsSection /> : null}
    </>
  )
}
