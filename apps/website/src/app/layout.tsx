import "./globals.css"
import type { Metadata } from "next"
import { ClientProviders } from "@website/components/ClientProviders"
import { cookies } from "next/headers"

const THEME_COOKIE_NAME = "readit-theme"

// Baseline title/description for every route. Pages that export their own
// metadata (or generateMetadata) fill in the "%s" slot with a page-specific
// title, e.g. a community or post name; routes without one fall back to "ReadIt".
export const metadata: Metadata = {
  title: {
    default: "ReadIt",
    template: "%s - ReadIt",
  },
  description: "ReadIt is a community of communities where you can dive into anything.",
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const initialDark = cookieStore.get(THEME_COOKIE_NAME)?.value === "dark"

  return (
    <html
      lang={"en"}
      className={initialDark ? "dark" : undefined}
      style={{ colorScheme: initialDark ? "dark" : "light" }}
      suppressHydrationWarning
    >
      <body>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  )
}
