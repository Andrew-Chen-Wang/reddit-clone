import type { CSSProperties, ReactNode } from "react"
import { Card, CardContent } from "@ui/base/ui/card"
import { cn } from "@ui/base/lib/utils"

export type CommunityPostFlairTemplate = {
  id: string
  text: string
  bgColor: string | null
  textColor: string | null
}

export type CommunityPostTypesCardProps = {
  templates: CommunityPostFlairTemplate[]
  /** The flair currently used to filter the feed, if any. */
  activeFlairId?: string | null
  /**
   * Each frontend renders its own navigation element (TanStack `Link` with a typed
   * `search`, Next `Link` with a query string) so the pill filters the feed. The card
   * supplies the pill's className and inline color style; the caller wraps its link.
   */
  renderPill: (args: {
    template: CommunityPostFlairTemplate
    active: boolean
    className: string
    style: CSSProperties | undefined
    children: ReactNode
  }) => ReactNode
}

const PILL_BASE =
  "inline-flex h-6 max-w-full items-center truncate rounded-full px-3 text-xs font-medium transition-colors"

function pillStyle(template: CommunityPostFlairTemplate): CSSProperties | undefined {
  if (!template.bgColor && !template.textColor) return undefined
  return {
    backgroundColor: template.bgColor ?? undefined,
    color: template.textColor ?? undefined,
  }
}

/**
 * Presentational "VIEW BY POST TYPES" rail card: the community's post flair templates
 * rendered as colored pills that filter the feed. Matches reddit's flair filter row.
 */
export function CommunityPostTypesCard({
  templates,
  activeFlairId = null,
  renderPill,
}: CommunityPostTypesCardProps) {
  if (templates.length === 0) return null

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          View by post types
        </h2>
        <div className="flex flex-wrap gap-2">
          {templates.map((template) => {
            const active = activeFlairId === template.id
            const hasColor = Boolean(template.bgColor) || Boolean(template.textColor)
            const className = cn(
              PILL_BASE,
              !hasColor && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
              hasColor && "hover:opacity-90",
              active && "ring-2 ring-ring ring-offset-2 ring-offset-background",
            )
            return renderPill({
              template,
              active,
              className,
              style: pillStyle(template),
              children: template.text,
            })
          })}
        </div>
      </CardContent>
    </Card>
  )
}
