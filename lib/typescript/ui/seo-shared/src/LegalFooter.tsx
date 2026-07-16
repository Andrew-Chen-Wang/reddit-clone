import { cn } from "@ui/base/lib/utils"

/**
 * Muted legal/links footer rendered at the bottom of the right rail (home,
 * community, post detail). When the rail is hidden/stacked at narrow widths it
 * simply falls below the main content column. Links point at Next.js SSR pages
 * (outside any SPA router), so plain anchors are used in both website and SPAs.
 */

const LINKS: { label: string; href: string }[] = [
  { label: "Readit Rules", href: "/rules" },
  { label: "Privacy Policy", href: "/legal" },
  { label: "User Agreement", href: "/legal" },
  { label: "Your Privacy Choices", href: "/legal" },
  { label: "Accessibility", href: "/legal" },
]

export function LegalFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn("flex flex-col gap-2 px-2 py-4 text-xs text-muted-foreground", className)}
    >
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {LINKS.map(({ label, href }) => (
          <li key={label}>
            <a href={href} className="hover:text-foreground hover:underline">
              {label}
            </a>
          </li>
        ))}
      </ul>
      <p>ReadIt, Inc. © 2026. All rights reserved.</p>
    </footer>
  )
}
