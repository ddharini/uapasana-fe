import { Link, useSearchParams } from "react-router"

import { PublicHeader } from "@/components/layout/PublicHeader"
import { LoadError } from "@/components/LoadError"
import { EmptyState, Skeleton } from "@/components/ui/primitives"
import { usePublishedSchedule } from "@/features/schedule/api"
import { nowParts, useNow } from "@/features/schedule/now"
import { DayHeading, DayPicker, Timeline } from "@/features/schedule/Timeline"

const UPDATED_AT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
})

/**
 * The programme for devotees, at /schedule — the link admins share on
 * WhatsApp. No sign-in. Shows only what an admin last published, and picks
 * up a new publish on its own while the page is open.
 */
export function PublicSchedule() {
  const now = nowParts(useNow())
  const { data, isPending, isError, error, refetch } = usePublishedSchedule()
  const [searchParams, setSearchParams] = useSearchParams()

  const days = data?.days ?? []
  // ?day= keeps the chosen day on refresh, and lets a link point at one day.
  const requested = searchParams.get("day")
  const selectedDay =
    days.find((d) => d.date === requested) ??
    days.find((d) => d.date === now.date) ??
    days[0]
  const dayNumber = selectedDay ? days.indexOf(selectedDay) + 1 : 0

  return (
    <div className="flex min-h-svh flex-col">
      <PublicHeader eyebrow="Schedule">
        <p className="max-w-prose text-xs/relaxed text-muted-foreground">
          Every session, day by day: when it starts, and where. Tap a place with
          a map link to open it in Google Maps.
        </p>
        <p className="text-xs/relaxed text-muted-foreground">
          Not registered yet?{" "}
          <Link
            to="/register"
            className="font-medium text-primary hover:underline"
          >
            Register here
          </Link>
        </p>
      </PublicHeader>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 pt-5 pb-10 sm:px-6 sm:py-6">
        {isError ? (
          <LoadError error={error} onRetry={() => void refetch()} />
        ) : isPending ? (
          <>
            <Skeleton className="h-20" />
            <Skeleton className="h-96" />
          </>
        ) : !selectedDay ? (
          <EmptyState
            title="The schedule is on its way"
            description="The schedule will appear here as soon as the organisers share it. Keep this link — it will update by itself."
          />
        ) : (
          <>
            <DayPicker
              days={days}
              selected={selectedDay.date}
              today={now.date}
              onSelect={(date) =>
                setSearchParams(
                  { day: date },
                  { replace: true, preventScrollReset: true }
                )
              }
            />
            <section
              aria-label={`Day ${dayNumber}`}
              className="flex flex-col gap-4"
            >
              <DayHeading day={selectedDay} number={dayNumber} />
              <Timeline day={selectedDay} now={now} />
            </section>
            {data?.publishedAt && (
              <p className="text-center text-2xs text-muted-foreground">
                Last updated {UPDATED_AT.format(new Date(data.publishedAt))}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  )
}
