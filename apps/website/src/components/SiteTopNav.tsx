import { buttonVariants } from "@ui/base/ui/button"
import { Input } from "@ui/base/ui/input"
import { Search } from "lucide-react"
import Link from "next/link"

/** Anonymous (logged-out) top navigation for public SSR pages. */
export function SiteTopNav() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="flex h-14 items-center gap-2 px-2 sm:px-4">
        {/* Left zone: logo */}
        <div className="flex flex-1 items-center">
          <Link href="/" className="text-lg font-bold text-primary">
            ReadIt
          </Link>
        </div>

        {/* Center zone: search, horizontally centered with a max width */}
        <div className="hidden min-w-0 flex-1 justify-center sm:flex">
          <div className="relative w-full max-w-2xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search ReadIt"
              aria-label="Search"
              className="h-10 rounded-full border-0 bg-muted/60 pl-10"
              disabled
            />
          </div>
        </div>

        {/* Right zone: actions */}
        <div className="flex flex-1 items-center justify-end gap-2">
          <Link href="/login" className={buttonVariants({ size: "sm" })}>
            Log In
          </Link>
        </div>
      </div>
    </header>
  )
}
