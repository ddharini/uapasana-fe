import {
  RiEraserLine,
  RiFileCopyLine,
  RiFlightLandLine,
  RiFlightTakeoffLine,
} from "@remixicon/react"
import { Controller, get, useFormContext } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/choice"
import { DatePicker, TimePicker } from "@/components/ui/date-time"
import { Field, Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/primitives"
import { EVENT } from "@/config/event"
import { useT } from "@/i18n/context"

import {
  EMPTY_FLIGHTS,
  FLIGHT_FIELDS,
  fullNameOf,
  hasSplitFlights,
  type FlightValues,
  type RegistrationFormValues,
} from "./schema"

/** Where one set of flights lives: the party's ("") or one person's. */
type FlightPrefix = "" | `members.${number}.`

/**
 * The flight in and the flight out of Ahmedabad airport, the only one the
 * transport team covers. Landing has a pickup to tick after the flight; it is
 * saved only when ticked, and then its day is required (needed to arrange
 * anything). There is no drop for the flight out: it is for the record, saved
 * when its day is given. Times and numbers only if known.
 */
function AirportLeg({
  leg,
  prefix,
  pickupLabel,
}: {
  leg: "Arrival" | "Departure"
  prefix: FlightPrefix
  pickupLabel: string
}) {
  const { t } = useT()
  const {
    control,
    register,
    watch,
    formState: { errors },
  } = useFormContext<RegistrationFormValues>()
  const arriving = leg === "Arrival"
  const date = `${prefix}india${leg}Date` as const
  const time = `${prefix}india${leg}Time` as const
  const flight = `${prefix}india${leg}Flight` as const
  const pickup = `${prefix}indiaNeedsPickup` as const
  const wanted = watch(pickup) && arriving
  const dateError: string | undefined = get(errors, date)?.message
  const Icon = arriving ? RiFlightLandLine : RiFlightTakeoffLine
  const days = EVENT.days
  const firstDay = days[0]
  const lastDay = days[days.length - 1]
  const dateLabel = arriving ? t("Landing day") : t("Flight day")
  const timeLabel = arriving ? t("Landing time") : t("Flight time")

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <p className="flex items-center gap-1.5 text-xs/relaxed font-medium">
        <Icon aria-hidden className="size-4 text-muted-foreground" />
        {arriving ? t("When you land") : t("For your flight out")}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Field label={dateLabel} required={wanted} error={dateError}>
          <Controller
            control={control}
            name={date}
            render={({ field }) => (
              <DatePicker
                id={date}
                aria-label={dateLabel}
                value={field.value}
                onChange={field.onChange}
                invalid={!!dateError}
                // Landing is before the event ends; flying out after it starts.
                {...(arriving ? { max: lastDay } : { min: firstDay })}
                defaultMonth={arriving ? firstDay : lastDay}
                highlight={days}
                highlightLabel={t("Event days")}
              />
            )}
          />
        </Field>
        <Field label={timeLabel}>
          <Controller
            control={control}
            name={time}
            render={({ field }) => (
              <TimePicker
                id={time}
                aria-label={timeLabel}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </Field>
      </div>

      <Field label={t("Flight number")}>
        <Input
          id={flight}
          placeholder={arriving ? "AI 144" : "AI 191"}
          autoComplete="off"
          className="uppercase placeholder:normal-case"
          {...register(flight)}
        />
      </Field>

      {arriving && (
        <Checkbox
          id={pickup}
          label={pickupLabel}
          description={t("The transport team meets you at arrivals.")}
          {...register(pickup)}
        />
      )}
    </div>
  )
}

/** The landing card and the flight-out card, side by side. */
function Flights({
  prefix,
  pickupLabel,
}: {
  prefix: FlightPrefix
  pickupLabel: string
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <AirportLeg leg="Arrival" prefix={prefix} pickupLabel={pickupLabel} />
      <AirportLeg leg="Departure" prefix={prefix} pickupLabel={pickupLabel} />
    </div>
  )
}

/**
 * For devotees from abroad (see `isOverseas`), on the people step: a pickup
 * from Ahmedabad airport, and the flight out. Both optional. Asked once for
 * the party, or — some may land days before the others — for each person
 * once "everyone lands and flies out on the same days" is unticked.
 */
export function IndiaTravelSection() {
  const { t } = useT()
  const { register, watch, getValues, setValue } =
    useFormContext<RegistrationFormValues>()
  const [type, members, mandal, sameFlights] = watch([
    "type",
    "members",
    "mandal",
    "sameFlights",
  ])
  const party = members.length > 1
  const split = hasSplitFlights({ members, mandal, sameFlights })

  /** Puts one set of flights in place: the party's, or a person's. */
  const setFlights = (prefix: FlightPrefix, flights: FlightValues) => {
    for (const field of FLIGHT_FIELDS) {
      setValue(`${prefix}${field}`, flights[field], { shouldDirty: true })
    }
  }
  const flightsOf = (values: FlightValues): FlightValues =>
    Object.fromEntries(
      FLIGHT_FIELDS.map((field) => [field, values[field]])
    ) as FlightValues
  const hasFlights = (values: FlightValues | undefined) =>
    !!values &&
    FLIGHT_FIELDS.some((field) => values[field] && values[field] !== "")

  /**
   * As with the dates: unticking starts every person on the party's flights,
   * so only those who land or fly out on other days need changing; ticking it
   * again starts the party's from the first person's, so nothing typed is lost.
   */
  const onSameFlightsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const first = getValues("members.0")
      if (!hasFlights(getValues()) && first) setFlights("", flightsOf(first))
      return
    }
    const shared = flightsOf(getValues())
    getValues("members").forEach((member, index) => {
      if (!hasFlights(member)) setFlights(`members.${index}.`, shared)
    })
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="flex items-center gap-2 font-heading text-sm font-medium">
          {t("Ahmedabad airport pickup")}
          <Badge variant="secondary">{t("Optional")}</Badge>
        </h3>
        <p className="text-xs/relaxed text-muted-foreground">
          {t(
            "Only at Ahmedabad airport (AMD). Landing elsewhere? Leave the pickup unticked."
          )}
        </p>
      </div>

      {party && (
        <Checkbox
          id="sameFlights"
          label={t("Everyone lands in and flies out of India on the same days")}
          description={t(
            "Untick if some of you land earlier or fly out on another day."
          )}
          {...register("sameFlights", { onChange: onSameFlightsChange })}
        />
      )}

      {!split ? (
        <Flights
          prefix=""
          pickupLabel={
            type === "individual"
              ? t("I need a pickup from Ahmedabad airport")
              : t("We need a pickup from Ahmedabad airport")
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {members.map((member, index) => {
            const name = fullNameOf(member) || t("Person {n}", { n: index + 1 })
            const filled = hasFlights(member)
            const above = index > 0 ? members[index - 1] : undefined
            return (
              <div
                key={index}
                className="group/person flex flex-col gap-2 border-b border-border pb-4 last:border-b-0 last:pb-0"
              >
                <div className="flex min-h-6 items-center justify-between gap-2">
                  <p className="text-xs/relaxed font-medium">{name}</p>
                  {/* "Clear" once this person has any flights; otherwise
                      "Same as above", once the person above has some. */}
                  {index > 0 && (filled || hasFlights(above)) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setFlights(
                          `members.${index}.`,
                          filled ? EMPTY_FLIGHTS : flightsOf(above!)
                        )
                      }
                      title={
                        filled
                          ? t("Clear {name}'s flights", { name })
                          : t("Copy {name}'s flights", {
                              name:
                                (above && fullNameOf(above)) ||
                                t("person {n}", { n: index }),
                            })
                      }
                      className="text-muted-foreground opacity-0 transition-opacity group-hover/person:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
                    >
                      {filled ? <RiEraserLine /> : <RiFileCopyLine />}
                      {filled ? t("Clear") : t("Same as above")}
                    </Button>
                  )}
                </div>
                <Flights
                  prefix={`members.${index}.`}
                  pickupLabel={t(
                    "{name} needs a pickup from Ahmedabad airport",
                    {
                      name,
                    }
                  )}
                />
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
