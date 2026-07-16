import { buttonVariants } from "@ui/base/ui/button"
import { cn } from "@ui/base/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@ui/base/ui/dropdown-menu"
import { Check, LayoutList, Rows3 } from "lucide-react"
import type { ViewMode } from "./useFeedView"

/** Card / Compact view dropdown, shared by every profile feed tab. */
export function FeedViewMenu({
  view,
  onChange,
}: {
  view: ViewMode
  onChange: (next: ViewMode) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
        aria-label="Change view"
      >
        {view === "compact" ? <Rows3 className="size-4" /> : <LayoutList className="size-4" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>View</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => {
              onChange("card")
            }}
          >
            <LayoutList className="size-4" />
            Card
            {view === "card" ? <Check className="ml-auto size-4" /> : null}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              onChange("compact")
            }}
          >
            <Rows3 className="size-4" />
            Compact
            {view === "compact" ? <Check className="ml-auto size-4" /> : null}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
