import { useQuery } from "@tanstack/react-query"
import { Outlet, createRootRoute } from "@tanstack/react-router"
import { SidebarInset, SidebarProvider } from "@ui/base/ui/sidebar"
import { AppSidebar } from "@frontends/dashboard/components/AppSidebar"
import { ChatDock } from "@frontends/dashboard/components/chat/ChatDock"
import { ChatDockProvider } from "@frontends/dashboard/components/chat/ChatDockContext"
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
    <ChatDockProvider>
      <SidebarProvider className="flex min-h-screen w-full flex-col">
        <TopNav />
        <div className="flex min-h-0 w-full flex-1">
          <AppSidebar />
          <SidebarInset className="min-w-0">
            <Outlet />
          </SidebarInset>
        </div>
      </SidebarProvider>
      <ChatDock />
    </ChatDockProvider>
  )
}
