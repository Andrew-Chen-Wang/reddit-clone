import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { getApiV1CommunityByNameOptions } from "@lib/api-client/generated/@tanstack/react-query.gen"
import { SubmitForm } from "@frontends/dashboard/components/SubmitForm"

export const Route = createFileRoute("/r_/$name/submit")({
  component: SubmitPage,
})

function SubmitPage() {
  const { name } = Route.useParams()
  const { data: community, isLoading } = useQuery(
    getApiV1CommunityByNameOptions({ path: { name } }),
  )

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!community) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-2xl flex-col items-center justify-center gap-2 px-4 text-center">
        <h1 className="text-xl font-semibold">Community not found</h1>
        <p className="text-sm text-muted-foreground">
          This community is private or doesn&apos;t exist.
        </p>
      </div>
    )
  }

  return (
    <SubmitForm
      fixedCommunity={{
        id: community.id,
        name: community.name,
        displayName: community.displayName,
      }}
    />
  )
}
