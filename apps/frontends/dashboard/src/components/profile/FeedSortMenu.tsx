import { buttonVariants } from "@ui/base/ui/button"
import { cn } from "@ui/base/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ui/base/ui/dropdown-menu"
import { ArrowUpDown, Check } from "lucide-react"
import type { TopWindow } from "@frontends/dashboard/components/PostFeed"

export type FeedSortDef = { value: string; label: string }

export const PROFILE_SORTS: FeedSortDef[] = [
  { value: "new", label: "New" },
  { value: "hot", label: "Hot" },
  { value: "top", label: "Top" },
]

export const TOP_WINDOWS: { value: TopWindow; label: string }[] = [
  { value: "hour", label: "Now" },
  { value: "day", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
  { value: "all", label: "All Time" },
]

/**
 * New / Hot / Top sort dropdown with an adjacent time-window dropdown that only
 * appears when "Top" is selected. Mirrors the reddit profile sort control.
 */
export function FeedSortMenu({
  sorts = PROFILE_SORTS,
  sort,
  onSortChange,
  topWindow,
  onTopWindowChange,
}: {
  sorts?: FeedSortDef[]
  sort: string
  onSortChange: (next: string) => void
  topWindow: TopWindow
  onTopWindowChange: (next: TopWindow) => void
}) {
  const activeSort = sorts.find((s) => s.value === sort) ?? sorts[0]
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}
        >
          <ArrowUpDown className="size-4" />
          {activeSort?.label}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {sorts.map((s) => (
            <DropdownMenuItem
              key={s.value}
              onClick={() => {
                onSortChange(s.value)
              }}
            >
              {s.value === sort ? <Check className="size-4" /> : <span className="size-4" />}
              {s.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {sort === "top" ? (
        <DropdownMenu>
          <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            {TOP_WINDOWS.find((w) => w.value === topWindow)?.label}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {TOP_WINDOWS.map((w) => (
              <DropdownMenuItem
                key={w.value}
                onClick={() => {
                  onTopWindowChange(w.value)
                }}
              >
                {w.value === topWindow ? <Check className="size-4" /> : <span className="size-4" />}
                {w.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </>
  )
}
