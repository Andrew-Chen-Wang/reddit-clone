"use client"

import { QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider, themeInitScript } from "@ui/spa-shared/theme"
import { Toaster } from "@ui/base/ui/sonner"
import { queryClient } from "@website/services/api"
import { useState } from "react"

export function ClientProviders({ children }: Readonly<{ children: React.ReactNode }>) {
  const [stateQueryClient] = useState(() => queryClient)

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      <ThemeProvider>
        <QueryClientProvider client={stateQueryClient}>
          {children}
          <Toaster />
        </QueryClientProvider>
      </ThemeProvider>
    </>
  )
}
