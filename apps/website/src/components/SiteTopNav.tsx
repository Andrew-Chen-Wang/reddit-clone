import { buttonVariants } from "@ui/base/ui/button"
import { Input } from "@ui/base/ui/input"
import { Search } from "lucide-react"
import Link from "next/link"

/** Anonymous (logged-out) top navigation for public SSR pages. */
export function SiteTopNav() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="flex h-14 items-center gap-4 px-4">
        <Link href="/" className="text-lg font-bold text-primary">
          ReadIt
        </Link>
        <div className="relative hidden max-w-md flex-1 sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search ReadIt"
            aria-label="Search"
            className="pl-9"
            disabled
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/login" className={buttonVariants({ size: "sm" })}>
            Log In
          </Link>
        </div>
      </div>
    </header>
  )
}
