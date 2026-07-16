import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { getApiAdminStatsOptions } from "@frontends/admin/lib/adminApi"

export const Route = createFileRoute("/")({
  component: AdminHome,
})

const CARDS: {
  key: "users" | "posts" | "communities" | "comments" | "reportsPending"
  label: string
}[] = [
  { key: "users", label: "Users" },
  { key: "posts", label: "Posts" },
  { key: "communities", label: "Communities" },
  { key: "comments", label: "Comments" },
  { key: "reportsPending", label: "Reports pending" },
]

function AdminHome() {
  const { data, isLoading } = useQuery(getApiAdminStatsOptions())

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Admin Overview</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {CARDS.map((card) => (
          <div key={card.key} className="rounded-lg border bg-card p-6">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-3xl font-bold">
              {isLoading || !data ? "—" : data[card.key].toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
