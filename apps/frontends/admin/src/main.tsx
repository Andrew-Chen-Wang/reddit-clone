import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import { Toaster } from "@ui/base/ui/sonner"
import { ThemeProvider } from "@ui/spa-shared/theme"
import { client } from "@lib/api-client/generated/client.gen"
import { client as adminClient } from "@lib/api-client/admin-generated/client.gen"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "@frontends/admin/app.css"
import { routeTree } from "@frontends/admin/routeTree.gen"
import { baseUrl } from "@lib/api-client/index"

client.setConfig({ baseUrl, credentials: "include" })
adminClient.setConfig({ baseUrl, credentials: "include" })

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1 },
    mutations: { retry: 0 },
  },
})

const router = createRouter({ routeTree, basepath: "/admin" })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
