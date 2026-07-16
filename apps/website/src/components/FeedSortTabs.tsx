import { buttonVariants } from "@ui/base/ui/button"
import { cn } from "@ui/base/lib/utils"
import Link from "next/link"

export type FeedSortTabsProps = {
  basePath: string
  current: string
  sorts: { value: string; label: string }[]
  /** Current time window (only relevant when sort=top). */
  t?: string
}

const TOP_WINDOWS = [
  { value: "day", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
  { value: "all", label: "All" },
]

/** Server-rendered sort controls: plain links so anonymous SSR needs no client JS. */
export function FeedSortTabs({ basePath, current, sorts, t = "day" }: FeedSortTabsProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {sorts.map((s) => (
          <Link
            key={s.value}
            href={`${basePath}?sort=${s.value}${s.value === "top" ? `&t=${t}` : ""}`}
            className={cn(
              buttonVariants({ variant: s.value === current ? "secondary" : "ghost", size: "sm" }),
            )}
          >
            {s.label}
          </Link>
        ))}
      </div>
      {current === "top" ? (
        <div className="flex flex-wrap items-center gap-1">
          {TOP_WINDOWS.map((w) => (
            <Link
              key={w.value}
              href={`${basePath}?sort=top&t=${w.value}`}
              className={cn(
                buttonVariants({ variant: w.value === t ? "secondary" : "ghost", size: "sm" }),
                "text-xs",
              )}
            >
              {w.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}
