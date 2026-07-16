import { buttonVariants } from "@ui/base/ui/button"
import { cn } from "@ui/base/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ui/base/ui/dropdown-menu"
import { Check, ListFilter } from "lucide-react"

export type OverviewFilter = "all" | "posts" | "comments"

const OPTIONS: { value: OverviewFilter; label: string }[] = [
  { value: "all", label: "Showing all content" },
  { value: "posts", label: "Posts only" },
  { value: "comments", label: "Comments only" },
]

/** Content-type filter on the Overview tab (reddit's "Showing all content"). */
export function OverviewFilterMenu({
  value,
  onChange,
}: {
  value: OverviewFilter
  onChange: (next: OverviewFilter) => void
}) {
  const active = OPTIONS.find((o) => o.value === value) ?? OPTIONS[0]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}
      >
        <ListFilter className="size-4" />
        {active?.label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {OPTIONS.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onClick={() => {
              onChange(o.value)
            }}
          >
            {o.value === value ? <Check className="size-4" /> : <span className="size-4" />}
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
