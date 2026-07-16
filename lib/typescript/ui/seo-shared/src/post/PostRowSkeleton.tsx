import { Skeleton } from "@ui/base/ui/skeleton"

export type PostRowSkeletonProps = {
  variant?: "card" | "compact"
}

/** Loading placeholder that mirrors the two PostRow layouts. */
export function PostRowSkeleton({ variant = "card" }: PostRowSkeletonProps) {
  if (variant === "compact") {
    return (
      <div className="flex items-center gap-3 border-b px-3 py-2 last:border-b-0">
        <Skeleton className="h-8 w-16 rounded-full" />
        <Skeleton className="size-6 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2 border-b px-3 py-3 last:border-b-0">
      <Skeleton className="h-3 w-40" />
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <div className="flex items-center gap-2 pt-1">
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-16 rounded-full" />
      </div>
    </div>
  )
}

/** Renders a list of card/compact skeletons. */
export function PostFeedSkeleton({
  count = 5,
  variant = "card",
}: {
  count?: number
  variant?: "card" | "compact"
}) {
  return (
    <div className={variant === "compact" ? "rounded-lg border" : "flex flex-col"}>
      {Array.from({ length: count }, (_, i) => (
        <PostRowSkeleton key={i} variant={variant} />
      ))}
    </div>
  )
}
