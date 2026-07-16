import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { ModQueue } from "@frontends/dashboard/components/mod/ModQueue"
import { getApiV1CommunityByNameOptions } from "@lib/api-client/generated/@tanstack/react-query.gen"

export const Route = createFileRoute("/mod/$name/")({
  component: QueuesPage,
})

function QueuesPage() {
  const { name } = Route.useParams()
  const aggregate = name === "mod"
  const { data: community } = useQuery({
    ...getApiV1CommunityByNameOptions({ path: { name } }),
    enabled: !aggregate,
  })

  const communityId = aggregate ? "mod" : community?.id
  if (!communityId) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading...</p>
  }

  return <ModQueue communityId={communityId} name={name} />
}
