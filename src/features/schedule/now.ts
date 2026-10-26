import * as React from "react"

/** Local "YYYY-MM-DD" and "HH:MM", to compare against the schedule's venue-time strings. */
export function nowParts(now: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  }
}

/** The current time, refreshed every minute, so "Now" moves along during the event. */
export function useNow() {
  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  return now
}
