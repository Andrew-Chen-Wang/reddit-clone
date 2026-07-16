import { cn } from "@ui/base/lib/utils"

export type CommunityIconSize = "sm" | "md" | "lg" | "xl"

const SIZE_PX: Record<CommunityIconSize, number> = {
  sm: 24,
  md: 32,
  lg: 56,
  xl: 88,
}

const SIZE_CLASS: Record<CommunityIconSize, string> = {
  sm: "size-6",
  md: "size-8",
  lg: "size-14",
  xl: "size-22",
}

export type CommunityIconProps = {
  name: string
  iconUrl?: string | null
  size?: CommunityIconSize
  className?: string
}

/** Deterministic hue (0-359) derived from the community name. */
function hueFromName(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) % 360
}

/**
 * Circular community avatar. Renders the provided icon image when available,
 * otherwise a Reddit-style default: a deterministically colored circle with an
 * "r/" glyph. Shared between SSR (website) and SPA (dashboard) so it must stay
 * presentational and framework-agnostic.
 */
export function CommunityIcon({ name, iconUrl, size = "md", className }: CommunityIconProps) {
  const dimension = SIZE_PX[size]
  const sizeClass = SIZE_CLASS[size]

  if (iconUrl) {
    return (
      // oxlint-disable-next-line no-img-element
      <img
        src={iconUrl}
        alt=""
        className={cn("shrink-0 rounded-full object-cover", sizeClass, className)}
      />
    )
  }

  const hue = hueFromName(name)
  const bg = `hsl(${hue} 65% 45%)`
  const fontSize = dimension * 0.42

  return (
    <svg
      viewBox={`0 0 ${dimension} ${dimension}`}
      width={dimension}
      height={dimension}
      aria-hidden="true"
      className={cn("shrink-0 rounded-full", sizeClass, className)}
    >
      <circle cx={dimension / 2} cy={dimension / 2} r={dimension / 2} fill={bg} />
      <text
        x="50%"
        y="52%"
        dominantBaseline="central"
        textAnchor="middle"
        fill="#ffffff"
        fontSize={fontSize}
        fontWeight={700}
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        r/
      </text>
    </svg>
  )
}
