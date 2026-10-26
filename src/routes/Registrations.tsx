import {
  RiDownload2Line,
  RiHotelBedLine,
  RiSearchLine,
  RiUserAddLine,
  RiWheelchairLine,
} from "@remixicon/react"
import * as React from "react"
import { Link, useNavigate, useSearchParams } from "react-router"

import { PageHeader } from "@/components/layout/AppShell"
import { LoadError } from "@/components/LoadError"
import { ShareLink } from "@/components/ShareLink"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge, EmptyState, Skeleton } from "@/components/ui/primitives"
import { NativeSelect } from "@/components/ui/select"
import { EVENT, MANDALS, NO_MANDAL, formatDay } from "@/config/event"
import { useRegistrations } from "@/features/registrations/api"
import {
  StatusBadge,
  TravelModeIcon,
  TypeBadge,
} from "@/features/registrations/components"
import {
  displayName,
  formatIndiaFlight,
  formatMeal,
} from "@/features/registrations/format"
import { SampleDataToggle } from "@/features/registrations/SampleDataToggle"
import {
  travelModesOf,
  travelOf,
  flightsOf,
  isSevak,
  wantsBed,
} from "@/features/registrations/stay"
import { isAdmin, useSession } from "@/lib/auth-client"
import { formatMobile } from "@/lib/phone"
import { formatTime } from "@/lib/time"
import {
  GENDERS,
  REGISTRATION_STATUSES,
  REGISTRATION_TYPES,
  TRAVEL_MODES,
  type Registration,
} from "@/features/registrations/types"

const FILTERS = ["type", "mandal", "status", "travel"] as const
type FilterKey = (typeof FILTERS)[number]

function matches(registration: Registration, query: string) {
  if (!query) return true
  const q = query.toLowerCase()
  return (
    registration.code.toLowerCase().includes(q) ||
    (registration.groupName ?? "").toLowerCase().includes(q) ||
    registration.members.some(
      (m) =>
        (m.code ?? "").toLowerCase().includes(q) ||
        m.fullName.toLowerCase().includes(q) ||
        // Matches "98765 43210", "+91 9876543210" and "43210" alike.
        (q.replace(/\D/g, "").length >= 3 &&
          (m.mobile ?? "").includes(q.replace(/\D/g, "")))
    )
  )
}

/** One row per person, which is what the kitchen and accommodation teams ask for. */
function downloadCsv(registrations: Registration[]) {
  const header = [
    "Person no.",
    "Family no.",
    "Status",
    "Type",
    "Family name",
    "Mandal",
    "Name",
    "Gender",
    "Age",
    "Mobile",
    "Relation",
    "Arrival",
    "Arrival time",
    "Arrival meal",
    "Departure",
    "Departure time",
    "Departure meal",
    "Swayam Sevak (early seva)",
    "Travel",
    "Vehicle numbers",
    "Station",
    "Pickup arrival time",
    "Pickup",
    "Drop",
    "Leaving by",
    "Journey home",
    "Leaving from",
    "Journey home time",
    "AMD pickup",
    "AMD flight out",
    "Accommodation",
    "Assistance",
    "Youth Convention",
    "Number confirmed",
  ]
  const rows = registrations.flatMap((r) =>
    r.members.map((m) => {
      // Their own way here when the party travels separately; vehicles are the party's.
      const travel = travelOf(r, m)
      // Their own airport flights when the party's differ.
      const flights = flightsOf(r, m)
      return [
        m.code ?? "",
        r.type === "family" ? r.code : "",
        REGISTRATION_STATUSES[r.status],
        REGISTRATION_TYPES[r.type],
        r.groupName ?? "",
        r.mandal,
        m.fullName,
        GENDERS[m.gender],
        m.age,
        m.mobile ? formatMobile(m.mobile) : "",
        m.isPrimary ? "Primary contact" : (m.relation ?? ""),
        m.arrival.date,
        m.arrival.slot,
        formatMeal(m.arrival),
        m.departure.date,
        m.departure.slot,
        formatMeal(m.departure),
        isSevak(r, m) ? "Yes" : "",
        TRAVEL_MODES[travel.mode],
        (r.travel.vehicleNumbers ?? []).join("; "),
        travel.station ?? "",
        travel.arrivalTime ? formatTime(travel.arrivalTime) : "",
        travel.needsPickup ? "Yes" : "",
        travel.needsDrop ? "Yes" : "",
        travel.departureMode ? TRAVEL_MODES[travel.departureMode] : "",
        travel.departureReference ?? "",
        travel.departureStation ?? "",
        travel.departureTime ? formatTime(travel.departureTime) : "",
        flights?.arrival ? formatIndiaFlight(flights.arrival) : "",
        flights?.departure ? formatIndiaFlight(flights.departure) : "",
        wantsBed(r, m) ? "Yes" : "No",
        m.needsAssistance ? (m.assistanceNote ?? "Yes") : "",
        m.attendsYouthConvention == null
          ? ""
          : m.attendsYouthConvention
            ? "Yes"
            : "No",
        r.mobileVerification === "otp"
          ? "OTP"
          : r.mobileVerification === "in_person"
            ? `In person (${r.verifiedByName ?? ""})`
            : "",
      ]
    })
  )
  const csv = [header, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n")
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
  const link = document.createElement("a")
  link.href = url
  link.download = `registrations-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function Registrations() {
  const navigate = useNavigate()
  const { data: session } = useSession()
  // A sanchalak sees one mandal, so a mandal filter would only get in the way.
  const scope =
    session?.user.role === "sanchalak" ? session.user.mandal : undefined
  const {
    data: registrations,
    isPending,
    isError,
    error,
    refetch,
  } = useRegistrations()
  // Filters live in the URL so a filtered list can be bookmarked or sent to
  // another volunteer.
  const [params, setParams] = useSearchParams()
  const query = params.get("q") ?? ""

  const setParam = (key: FilterKey | "q", value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const filtered = React.useMemo(
    () =>
      (registrations ?? []).filter(
        (r) =>
          matches(r, query) &&
          (!params.get("type") || r.type === params.get("type")) &&
          (!params.get("mandal") || r.mandal === params.get("mandal")) &&
          (!params.get("status") || r.status === params.get("status")) &&
          // A party travelling separately matches each of its ways too.
          (!params.get("travel") ||
            r.travel.mode === params.get("travel") ||
            travelModesOf(r).some((mode) => mode === params.get("travel")))
      ),
    [registrations, params, query]
  )

  const people = filtered.reduce((sum, r) => sum + r.members.length, 0)
  const anyFilter = query !== "" || FILTERS.some((key) => params.get(key))

  const filterSelect = (
    key: FilterKey,
    label: string,
    options: [string, string][]
  ) => (
    <NativeSelect
      id={`filter-${key}`}
      aria-label={label}
      value={params.get(key) ?? ""}
      onChange={(e) => setParam(key, e.target.value)}
      className="sm:w-40"
    >
      <option value="">{label}: all</option>
      {options.map(([value, text]) => (
        <option key={value} value={value}>
          {text}
        </option>
      ))}
    </NativeSelect>
  )

  return (
    <>
      <PageHeader
        title={scope ? `Registrations · ${scope}` : "Registrations"}
        description={
          isPending
            ? "Loading…"
            : `${filtered.length} of ${registrations?.length ?? 0} registrations · ${people} people`
        }
        actions={
          <>
            {isAdmin(session?.user.role) && <SampleDataToggle />}
            <Button
              variant="outline"
              size="lg"
              disabled={filtered.length === 0}
              onClick={() => downloadCsv(filtered)}
            >
              <RiDownload2Line />
              Export CSV
            </Button>
            {/* The one way in to the form now that it has no tab of its own. */}
            <Link
              to="/registrations/new"
              className={buttonVariants({ size: "lg" })}
            >
              <RiUserAddLine />
              New registration
            </Link>
          </>
        }
      />

      <ShareLink
        title="Registration form link"
        description="For devotees to register themselves or their family, in English or Gujarati. No sign-in needed."
        path="/register"
        // In both languages: the form offers both.
        whatsappText={`${EVENT.name} — register yourself and your family here. The form can be filled in English or Gujarati.\n${EVENT.name} — તમારી અને તમારા પરિવારની નોંધણી અહીં કરો. ફોર્મ ગુજરાતીમાં પણ ભરી શકાય છે.`}
        openLabel="Open the registration form"
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative sm:min-w-56 sm:flex-1">
          <RiSearchLine className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground sm:left-2.5 sm:size-3.5" />
          <Input
            id="search"
            type="search"
            value={query}
            onChange={(e) => setParam("q", e.target.value)}
            placeholder="Search name, mobile or code"
            className="pl-10 sm:pl-8"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          {filterSelect("type", "Type", Object.entries(REGISTRATION_TYPES))}
          {filterSelect(
            "status",
            "Status",
            Object.entries(REGISTRATION_STATUSES)
          )}
          {!scope &&
            filterSelect(
              "mandal",
              "Mandal",
              [...MANDALS, NO_MANDAL].map((m) => [m, m])
            )}
          {filterSelect("travel", "Travel", Object.entries(TRAVEL_MODES))}
        </div>
        {anyFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setParams({}, { replace: true })}
          >
            Clear filters
          </Button>
        )}
      </div>

      {isError ? (
        <LoadError error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <Skeleton className="h-96" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No registrations match"
          description="Try a different name or mobile number, or clear the filters."
        />
      ) : (
        <>
          {/* Phones get a list; the table needs more width than a phone has. */}
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border md:hidden">
            {filtered.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/registrations/${r.id}`}
                  className="flex flex-col gap-1.5 px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs/relaxed font-medium">
                      {displayName(r)}
                    </span>
                    <StatusBadge status={r.status} />
                  </div>
                  <span className="text-2xs text-muted-foreground tabular-nums">
                    {r.isSample && "Dummy · "}
                    {r.code} · {REGISTRATION_TYPES[r.type]} · {r.members.length}{" "}
                    {r.members.length === 1 ? "person" : "people"} · {r.mandal}
                  </span>
                  <span className="text-2xs text-muted-foreground tabular-nums">
                    {formatDay(r.arrival.date)} → {formatDay(r.departure.date)}{" "}
                    ·{" "}
                    <TravelModeIcon
                      mode={r.travel.mode}
                      className="inline size-3.5 -translate-y-px align-middle"
                    />{" "}
                    {TRAVEL_MODES[r.travel.mode]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
            <table className="w-full text-left text-xs/relaxed">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Code</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Mandal</th>
                  <th className="px-3 py-2 text-right font-medium">People</th>
                  <th className="px-3 py-2 font-medium">Dates</th>
                  <th className="px-3 py-2 font-medium">Travel</th>
                  <th className="px-3 py-2 font-medium">
                    <span className="sr-only">Needs</span>
                  </th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => navigate(`/registrations/${r.id}`)}
                    className="cursor-pointer transition-colors hover:bg-muted/50"
                  >
                    <td className="px-3 py-2 font-medium whitespace-nowrap tabular-nums">
                      <Link
                        to={`/registrations/${r.id}`}
                        className="hover:underline"
                      >
                        {r.code}
                      </Link>
                      {r.isSample && (
                        <Badge variant="outline" className="ml-1.5">
                          Dummy
                        </Badge>
                      )}
                    </td>
                    <td className="max-w-56 px-3 py-2">
                      <div className="truncate font-medium">
                        {displayName(r)}
                      </div>
                      {r.type !== "individual" && (
                        <div className="truncate text-2xs text-muted-foreground">
                          {r.members[0].fullName}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <TypeBadge type={r.type} />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.mandal}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.members.length}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                      {formatDay(r.arrival.date)} →{" "}
                      {formatDay(r.departure.date)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <TravelModeIcon
                          mode={r.travel.mode}
                          className="size-4 shrink-0 text-muted-foreground"
                        />
                        {TRAVEL_MODES[r.travel.mode]}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        {r.accommodationRequired && (
                          <span title="Needs accommodation">
                            <RiHotelBedLine
                              className="size-3.5"
                              aria-label="Needs accommodation"
                            />
                          </span>
                        )}
                        {r.members.some((m) => m.needsAssistance) && (
                          <span title="Someone needs assistance">
                            <RiWheelchairLine
                              className="size-3.5"
                              aria-label="Someone needs assistance"
                            />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}
