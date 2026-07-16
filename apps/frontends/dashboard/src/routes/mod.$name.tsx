import { useQuery } from "@tanstack/react-query"
import { Link, Outlet, createFileRoute, useNavigate } from "@tanstack/react-router"
import { buttonVariants } from "@ui/base/ui/button"
import { cn } from "@ui/base/lib/utils"
import { CommunityIcon } from "@ui/seo-shared/community/CommunityIcon"
import { ModToolsNav } from "@frontends/dashboard/components/mod/ModToolsNav"
import { mediaUrl } from "@frontends/dashboard/lib/mediaUrl"
import { getApiV1CommunityByNameOptions } from "@lib/api-client/generated/@tanstack/react-query.gen"
import { ArrowLeft } from "lucide-react"
import { useEffect } from "react"
import { toast } from "sonner"

export const Route = createFileRoute("/mod/$name")({
  component: ModLayout,
})

/**
 * The r/Mod aggregate view uses the literal community id "mod". Unlike the
 * single-community mod tools, the aggregate queue has no left ModToolsNav — it
 * is full-width and the queue itself renders the heading, toolbar, and the
 * insights rail (via ModQueue).
 */
function AggregateLayout() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <Outlet />
    </div>
  )
}

function ModLayout() {
  const { name } = Route.useParams()
  const navigate = useNavigate()

  if (name === "mod") return <AggregateLayout />

  return <CommunityModLayout name={name} navigate={navigate} />
}

function CommunityModLayout({
  name,
  navigate,
}: {
  name: string
  navigate: ReturnType<typeof useNavigate>
}) {
  const {
    data: community,
    isLoading,
    isError,
  } = useQuery(getApiV1CommunityByNameOptions({ path: { name } }))

  const denied = !isLoading && (isError || !community || !community.viewer.isModerator)

  useEffect(() => {
    if (denied) {
      toast.error("You don't moderate this community")
      void navigate({ to: "/" })
    }
  }, [denied, navigate])

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (denied || !community) return null

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <Link
          to="/r/$name"
          params={{ name }}
          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
          aria-label="Back to community"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <CommunityIcon name={name} iconUrl={mediaUrl(community.iconImageKey)} size="sm" />
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold leading-tight">
            {community.displayName ?? `r/${name}`}
          </h1>
          <p className="text-xs text-muted-foreground">Mod tools · r/{name}</p>
        </div>
      </div>
      <div className="flex flex-col gap-6 lg:flex-row">
        <ModToolsNav name={name} />
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
