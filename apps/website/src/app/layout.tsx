import "./globals.css"
import { ClientProviders } from "@website/components/ClientProviders"
import { cookies } from "next/headers"

const THEME_COOKIE_NAME = "readit-theme"

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
