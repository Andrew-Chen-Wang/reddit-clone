import { useQuery } from "@tanstack/react-query"
import { Navigate, createFileRoute } from "@tanstack/react-router"
import { getApiV1UserMeOptions } from "@lib/api-client/generated/@tanstack/react-query.gen"

export const Route = createFileRoute("/profile")({
  component: ProfileRedirect,
})

function ProfileRedirect() {
  const { data, isLoading } = useQuery(getApiV1UserMeOptions())

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!data) {
    return <Navigate to="/dashboard" />
  }

  return <Navigate to="/user/$username" params={{ username: data.username }} />
}
