import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/r/$name/submit")({
  component: SubmitPage,
})

function SubmitPage() {
  const { name } = Route.useParams()
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-2xl flex-col items-center justify-center gap-2 px-4 text-center">
      <h1 className="text-xl font-semibold">Submit to r/{name}</h1>
      <p className="text-sm text-muted-foreground">Post creation is coming soon.</p>
    </div>
  )
}
