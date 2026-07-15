"use client"

import * as React from "react"

export function formatRelativeTime(date: Date, now: number = Date.now()): string {
  const diffMs = now - date.getTime()
  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return "just now"
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min. ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hr. ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day} ${day === 1 ? "day" : "days"} ago`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo} mo. ago`
  const yr = Math.floor(day / 365)
  return `${yr} yr. ago`
}

export type RelativeTimeProps = Omit<React.ComponentProps<"time">, "dateTime"> & {
  date: string | number | Date
}

export function RelativeTime({ date, ...props }: RelativeTimeProps) {
  const target = React.useMemo(() => new Date(date), [date])
  const [now, setNow] = React.useState(() => Date.now())

  React.useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => {
      setNow(Date.now())
    }, 60_000)
    return () => {
      clearInterval(id)
    }
  }, [])

  return (
    <time
      dateTime={target.toISOString()}
      title={target.toLocaleString()}
      suppressHydrationWarning
      {...props}
    >
      {formatRelativeTime(target, now)}
    </time>
  )
}
