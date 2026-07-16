import { buttonVariants } from "@ui/base/ui/button"
import Link from "next/link"

/**
 * App-wide 404 UI. Rendered inside the root layout (so it inherits the theme)
 * whenever a route segment calls `notFound()` — e.g. an unknown community or
 * user, a private community viewed anonymously, or a bad post id. Replaces
 * Next's blank built-in fallback with a branded, themed page.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-[100svh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-6xl font-bold tracking-tight text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold">This page could not be found</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist, or the community may be private.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Link href="/" className={buttonVariants()}>
          Go home
        </Link>
        <Link href="/explore" className={buttonVariants({ variant: "outline" })}>
          Explore communities
        </Link>
      </div>
    </main>
  )
}
