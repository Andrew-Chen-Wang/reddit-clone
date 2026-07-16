import { Link, useMatchRoute } from "@tanstack/react-router"
import { cn } from "@ui/base/lib/utils"
import {
  Bell,
  BookOpen,
  CalendarClock,
  FileText,
  Gavel,
  LayoutGrid,
  ListChecks,
  Mail,
  MessageSquareText,
  ScrollText,
  Settings,
  UserX,
  Users,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

type NavLink = {
  label: string
  icon: LucideIcon
  to: string
  exact?: boolean
  disabled?: boolean
}

type NavSection = { heading: string; items: NavLink[] }

const SECTIONS: NavSection[] = [
  {
    heading: "Overview",
    items: [
      { label: "Queues", icon: ListChecks, to: "/mod/$name", exact: true },
      { label: "Mod Mail", icon: Mail, to: "/mod/$name/modmail" },
      { label: "Scheduled Posts", icon: CalendarClock, to: "/mod/$name/scheduled" },
      { label: "Restricted Users", icon: UserX, to: "/mod/$name/restricted" },
      { label: "Mods & Members", icon: Users, to: "/mod/$name/members" },
    ],
  },
  {
    heading: "Moderation",
    items: [
      { label: "Rules", icon: Gavel, to: "/mod/$name/rules" },
      { label: "Wiki", icon: BookOpen, to: "/mod/$name/wiki" },
      { label: "Saved Responses", icon: MessageSquareText, to: "/mod/$name/saved-responses" },
      { label: "Mod Log", icon: ScrollText, to: "/mod/$name/log" },
    ],
  },
  {
    heading: "Settings",
    items: [
      { label: "General", icon: Settings, to: "/mod/$name/settings" },
      { label: "Posts & Comments", icon: FileText, to: "/mod/$name/posts-settings" },
      { label: "Widgets", icon: LayoutGrid, to: "/mod/$name/widgets" },
      { label: "Notifications", icon: Bell, to: "/mod/$name/notifications" },
    ],
  },
]

/**
 * Left navigation rail for the mod tools surface. When `aggregate` is set (the
 * r/Mod cross-community view) only the Queues entry is shown, since the other
 * tools operate on a single community.
 */
export function ModToolsNav({ name, aggregate = false }: { name: string; aggregate?: boolean }) {
  const matchRoute = useMatchRoute()

  const sections = aggregate ? [{ heading: "Overview", items: [SECTIONS[0].items[0]] }] : SECTIONS

  return (
    <nav className="flex w-full shrink-0 flex-col gap-5 lg:w-56" aria-label="Mod tools">
      {sections.map((section) => (
        <div key={section.heading} className="flex flex-col gap-1">
          <p className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {section.heading}
          </p>
          {section.items.map((item) => {
            const Icon = item.icon
            const active =
              !item.disabled &&
              Boolean(
                matchRoute({
                  to: item.to,
                  params: { name },
                  fuzzy: !item.exact,
                }),
              )
            const className = cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              item.disabled
                ? "cursor-not-allowed text-muted-foreground/50"
                : active
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground/80 hover:bg-accent/60",
            )
            if (item.disabled) {
              return (
                <span key={item.label} className={className} aria-disabled>
                  <Icon className="size-4" />
                  {item.label}
                  <span className="ml-auto text-[10px] text-muted-foreground/60">soon</span>
                </span>
              )
            }
            return (
              <Link key={item.label} to={item.to} params={{ name }} className={className}>
                <Icon className="size-4" />
                {item.label}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
