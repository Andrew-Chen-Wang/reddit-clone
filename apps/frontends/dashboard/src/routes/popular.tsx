import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/popular")({
  component: PopularPage,
})

function PopularPage() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-2xl flex-col items-center justify-center gap-2 px-4 text-center">
      <h1 className="text-xl font-semibold">Popular</h1>
      <p className="text-sm text-muted-foreground">Trending posts are coming soon.</p>
    </div>
  )
}
