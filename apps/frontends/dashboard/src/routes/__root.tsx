import { useQuery } from "@tanstack/react-query"
import { Outlet, createRootRoute } from "@tanstack/react-router"
import { SidebarInset, SidebarProvider } from "@ui/base/ui/sidebar"
import { AppSidebar } from "@frontends/dashboard/components/AppSidebar"
import { TopNav } from "@frontends/dashboard/components/TopNav"
import { getApiV1AuthMeOptions } from "@lib/api-client/generated/@tanstack/react-query.gen"

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const { data, isLoading, isError } = useQuery(getApiV1AuthMeOptions())

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (isError || !data?.user) {
    window.location.href = `${import.meta.env.VITE_NEXTJS_URL ?? ""}/login?next=${window.location.pathname}`
    return null
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav />
      <SidebarProvider className="min-h-0 flex-1">
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}
