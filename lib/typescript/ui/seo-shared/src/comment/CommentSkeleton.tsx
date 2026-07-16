import { Skeleton } from "@ui/base/ui/skeleton"

/** Loading placeholder for the comment tree. */
export function CommentSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-6">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-2" style={{ marginLeft: (i % 3) * 24 }}>
          <div className="flex items-center gap-2">
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-3 w-full max-w-md" />
          <Skeleton className="h-3 w-2/3 max-w-sm" />
        </div>
      ))}
    </div>
  )
}
