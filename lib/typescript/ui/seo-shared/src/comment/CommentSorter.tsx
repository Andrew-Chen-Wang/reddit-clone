"use client"

import { ArrowUpDown, Check, ChevronDown } from "lucide-react"
import { cn } from "@ui/base/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ui/base/ui/dropdown-menu"
import { SeoLink } from "@ui/seo-shared/_internal/seo-link"
import type { CommentSortValue } from "@ui/seo-shared/comment/types"

export const COMMENT_SORTS: { value: CommentSortValue; label: string }[] = [
  { value: "best", label: "Best" },
  { value: "top", label: "Top" },
  { value: "new", label: "New" },
  { value: "controversial", label: "Controversial" },
  { value: "old", label: "Old" },
]

export function commentSortLabel(sort: CommentSortValue): string {
  return COMMENT_SORTS.find((s) => s.value === sort)?.label ?? "Best"
}

export type CommentSorterProps = {
  sort: CommentSortValue
  /** Callback mode (SPA): fired when a sort is chosen. */
  onSortChange?: (sort: CommentSortValue) => void
  /** Link mode (SSR): renders each option as a crawlable query-param link. */
  buildHref?: (sort: CommentSortValue) => string
  className?: string
}

/**
 * Sort dropdown for the comment tree. Presentational; either drives a callback
 * (SPA) or renders each option as a plain link that re-renders the page (SSR).
 */
export function CommentSorter({ sort, onSortChange, buildHref, className }: CommentSorterProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-muted-foreground hover:bg-muted",
          className,
        )}
      >
        <ArrowUpDown className="size-3.5" />
        <span>Sort by: {commentSortLabel(sort)}</span>
        <ChevronDown className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {COMMENT_SORTS.map((option) =>
          buildHref ? (
            <DropdownMenuItem
              key={option.value}
              render={<SeoLink href={buildHref(option.value)} />}
            >
              <SortRow active={option.value === sort} label={option.label} />
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              key={option.value}
              onClick={() => {
                onSortChange?.(option.value)
              }}
            >
              <SortRow active={option.value === sort} label={option.label} />
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SortRow({ active, label }: { active: boolean; label: string }) {
  return (
    <span className="flex w-full items-center justify-between gap-4">
      {label}
      {active ? <Check className="size-4" /> : null}
    </span>
  )
}
