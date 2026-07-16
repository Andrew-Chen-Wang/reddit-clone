import { useQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { Card, CardContent, CardHeader, CardTitle } from "@ui/base/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@ui/base/ui/tooltip"
import { formatCompactNumber } from "@ui/seo-shared/format-number"
import { getApiV1PostInsightsByPostIdOptions } from "@lib/api-client/generated/@tanstack/react-query.gen"
import { ArrowLeft, Eye, MessageSquare, Repeat2, Share2, ThumbsUp } from "lucide-react"
import type { ReactNode } from "react"

export const Route = createFileRoute("/poststats/$postId")({
  component: PostStatsPage,
})

const HOUR_MS = 60 * 60 * 1000
const WINDOW_HOURS = 48

interface HourBar {
  label: string
  count: number
}

function buildHourBars(buckets: { bucket: Date; count: number }[]): HourBar[] {
  const counts = new Map<number, number>()
  for (const b of buckets) {
    counts.set(new Date(b.bucket).getTime(), b.count)
  }
  const nowHour = Math.floor(Date.now() / HOUR_MS) * HOUR_MS
  const bars: HourBar[] = []
  for (let i = WINDOW_HOURS - 1; i >= 0; i--) {
    const t = nowHour - i * HOUR_MS
    const d = new Date(t)
    bars.push({
      label: d.toLocaleString(undefined, {
        weekday: "short",
        hour: "numeric",
      }),
      count: counts.get(t) ?? 0,
    })
  }
  return bars
}

function PostStatsPage() {
  const { postId } = Route.useParams()
  const { data, isLoading, isError, error } = useQuery(
    getApiV1PostInsightsByPostIdOptions({ path: { postId } }),
  )

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading insights...</p>
      </div>
    )
  }

  if (isError || !data) {
    const status = (error as { status?: number } | null)?.status
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-3xl flex-col items-center justify-center gap-2 px-4 text-center">
        <h1 className="text-xl font-semibold">Insights unavailable</h1>
        <p className="text-sm text-muted-foreground">
          {status === 403
            ? "Only the author of this post can view its insights."
            : "This post could not be found."}
        </p>
      </div>
    )
  }

  const bars = buildHourBars(data.views48h)
  const maxCount = Math.max(1, ...bars.map((b) => b.count))
  const upvotePct = Math.round(data.upvoteRatio * 100)
  const communityName = data.communityName

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-col gap-1">
        {communityName ? (
          <Link
            to="/r/$name/comments/$"
            params={{ name: communityName, _splat: postId }}
            className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to post
          </Link>
        ) : null}
        <h1 className="text-2xl font-bold">Post Insights</h1>
        <p className="truncate text-sm text-muted-foreground">{data.postTitle}</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex-1 rounded-lg border bg-primary/5 px-4 py-3">
          <p className="text-sm font-medium">
            Your <span className="text-primary">#{data.rankAllTime}</span> post of all time
          </p>
        </div>
        {data.rankInCommunityToday !== null && data.rankInCommunityToday <= 10 && communityName ? (
          <div className="flex-1 rounded-lg border bg-primary/5 px-4 py-3">
            <p className="text-sm font-medium">
              <span className="text-primary">#{data.rankInCommunityToday}</span> post on{" "}
              <Link to="/r/$name" params={{ name: communityName }} className="hover:underline">
                r/{communityName}
              </Link>{" "}
              today
            </p>
          </div>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="h-4 w-4" /> Reach
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <p className="text-3xl font-bold">{formatCompactNumber(data.viewsTotal)}</p>
            <p className="text-sm text-muted-foreground">total views</p>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Views, last 48 hours</p>
            <TooltipProvider>
              <div className="flex h-28 items-end gap-[2px]">
                {bars.map((bar) => (
                  <Tooltip key={bar.label}>
                    <TooltipTrigger render={<div className="flex h-full flex-1 items-end" />}>
                      <div
                        className="w-full rounded-t-sm bg-primary/70 transition-colors hover:bg-primary"
                        style={{
                          height: `${Math.max(bar.count === 0 ? 2 : 6, (bar.count / maxCount) * 100)}%`,
                        }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      {bar.label}: {bar.count} {bar.count === 1 ? "view" : "views"}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Engagement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Metric icon={<ThumbsUp className="h-4 w-4" />} label="Upvotes" value={data.ups} />
            <Metric
              icon={<ThumbsUp className="h-4 w-4" />}
              label="Upvote ratio"
              value={`${upvotePct}%`}
            />
            <Metric
              icon={<MessageSquare className="h-4 w-4" />}
              label="Comments"
              value={data.commentCount}
            />
            <Metric icon={<Share2 className="h-4 w-4" />} label="Shares" value={data.shareCount} />
            <Metric
              icon={<Repeat2 className="h-4 w-4" />}
              label="Crossposts"
              value={data.crosspostCount}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top comments</CardTitle>
        </CardHeader>
        <CardContent>
          {data.topComments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.topComments.map((comment) => (
                <li key={comment.id} className="flex flex-col gap-1 border-b pb-3 last:border-b-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {comment.authorUsername ? `u/${comment.authorUsername}` : "[deleted]"}
                    </span>
                    <span>·</span>
                    <span>{formatCompactNumber(comment.score)} points</span>
                  </div>
                  <p className="text-sm">{comment.snippet || "[no text]"}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: number | string
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="text-xl font-semibold">
        {typeof value === "number" ? formatCompactNumber(value) : value}
      </p>
    </div>
  )
}
