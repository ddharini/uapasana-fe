import { useFormContext } from "react-hook-form"

import { Checkbox } from "@/components/ui/choice"
import { Badge } from "@/components/ui/primitives"
import { RequiredMark } from "@/components/ui/input"
import { isLocalMandal, type StayDate, type TimeSlot } from "@/config/event"
import { useT } from "@/i18n/context"
import type { Lang } from "@/i18n/translate"
import { formatMobile, toE164 } from "@/lib/phone"
import { formatTime } from "@/lib/time"

import {
  GENDERS,
  REGISTRATION_TYPES,
  TRAVEL_MODES,
  type Gender,
  type TravelMode,
} from "../types"
import { formatIndiaFlight, formatStay } from "../format"
import {
  fullNameOf,
  comesByVehicle,
  hasSplitDates,
  hasSplitTravel,
  hasSplitFlights,
  indiaTravelOf,
  bedsWanted,
  needsAccommodation,
  offersPickup,
  asksYouthConvention,
  vehicleSlots,
  type MemberFormValues,
  type RegistrationFormValues,
  type TripValues,
} from "./schema"

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 py-2.5 text-xs/relaxed sm:grid-cols-[8rem_minmax(0,1fr)] sm:py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

const stayText = (date: string, slot: string, meal: string, lang: Lang) =>
  date && slot
    ? formatStay(
        {
          date: date as StayDate,
          slot: slot as TimeSlot,
          meal: meal === "" ? undefined : meal === "yes",
        },
        lang
      )
    : "—"

/**
 * How someone travels, for the party or one person: "Train · 12009 Shatabdi
 * Exp · Sabarmati · arrives 6:30 am" with Pickup and Drop badges, and the
 * journey home on its own line when a drop is wanted.
 */
function TripSummary({ trip }: { trip: TripValues }) {
  const { t } = useT()
  const mode = trip.travelMode as TravelMode
  if (!mode) return <>—</>
  const pickup = offersPickup(mode) && trip.needsPickup === "yes"
  const drop = pickup && trip.needsDrop
  const arriving = [
    t(TRAVEL_MODES[mode]),
    // By train or bus, the details come only with a pickup.
    mode !== "personal_vehicle" &&
      (!offersPickup(mode) || pickup) &&
      trip.travelReference,
    mode === "train" && pickup && trip.travelStation && t(trip.travelStation),
    pickup &&
      trip.travelTime &&
      t("arrives {time}", { time: formatTime(trip.travelTime) }),
  ]
    .filter(Boolean)
    .join(" · ")
  // "Train · 12010 Shatabdi Exp · Sabarmati · leaves 6:45 pm": how they leave,
  // which need not be how they came, and its details.
  const home =
    drop && offersPickup(trip.dropMode)
      ? [
          t(TRAVEL_MODES[trip.dropMode]),
          trip.dropReference,
          trip.dropMode === "train" && t(trip.dropStation),
          trip.dropTime &&
            t("leaves {time}", { time: formatTime(trip.dropTime) }),
        ]
          .filter(Boolean)
          .join(" · ")
      : ""
  return (
    <>
      {arriving}
      {pickup && (
        <Badge variant="info" className="ml-2 align-middle">
          {t("Pickup needed")}
        </Badge>
      )}
      {drop && (
        <Badge variant="info" className="ml-2 align-middle">
          {t("Drop needed")}
        </Badge>
      )}
      {home && (
        <span className="block text-muted-foreground">
          {t("Journey home")}: {home}
        </span>
      )}
    </>
  )
}

/** Step 4: everything on one screen before it is sent. */
export function ReviewStep({
  onEditStep,
}: {
  onEditStep: (step: number) => void
}) {
  const {
    register,
    getValues,
    formState: { errors },
  } = useFormContext<RegistrationFormValues>()
  const { t, lang } = useT()
  const values = getValues()
  const beds = bedsWanted(values)
  // From abroad: the party's airport flights, or each person's.
  const splitFlights = hasSplitFlights(values)
  const india = splitFlights ? undefined : indiaTravelOf(values)
  const ownFlights = (member: MemberFormValues) =>
    indiaTravelOf({ ...member, mandal: values.mandal })
  const local = isLocalMandal(values.mandal)
  const splitDates = hasSplitDates(values)
  const splitTravel = hasSplitTravel(values)
  const vehicleCount = vehicleSlots(values)
  // Who is arriving early for seva as a Swayam Sevak, by name.
  const sevaks = values.members
    .map((member, index) =>
      member.earlySeva
        ? fullNameOf(member) || t("Person {n}", { n: index + 1 })
        : ""
    )
    .filter(Boolean)
  const vehicleNumbers = values.vehicleNumbers
    .slice(0, vehicleCount)
    .map((number) => (number ?? "").trim().toUpperCase())
    .filter(Boolean)

  const editButton = (step: number) => (
    <button
      type="button"
      onClick={() => onEditStep(step)}
      className="-mr-2 rounded-md px-2 py-1.5 text-2xs text-primary hover:underline"
    >
      {t("Edit")}
    </button>
  )

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-sm font-medium">
            {t("Registration")}
          </h3>
          {editButton(0)}
        </div>
        <dl className="divide-y divide-border">
          <Row label={t("Type")}>{t(REGISTRATION_TYPES[values.type])}</Row>
          {values.type !== "individual" && (
            <Row label={t("Name")}>{values.groupName}</Row>
          )}
          <Row label={t("Satsang mandal")}>{t(values.mandal)}</Row>
        </dl>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-sm font-medium">
            {t("People ({n})", { n: values.members.length })}
          </h3>
          {editButton(1)}
        </div>
        <ul className="divide-y divide-border rounded-md border border-border">
          {values.members.map((member, index) => (
            <li
              key={index}
              className="flex flex-col gap-0.5 px-3 py-2.5 sm:py-2"
            >
              <span className="text-xs/relaxed font-medium break-words">
                {fullNameOf(member)}
                {index === 0 && (
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · {t("contact")}
                  </span>
                )}
                {member.relation && index > 0 && values.type === "family" && (
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · {t(member.relation)}
                  </span>
                )}
              </span>
              <span className="text-2xs/relaxed text-muted-foreground tabular-nums">
                {t(GENDERS[member.gender as Gender])} ·{" "}
                {t("{age} yrs", { age: member.age })}
                {member.mobile &&
                  ` · ${formatMobile(toE164(member.mobileCountry, member.mobile))}`}
                {member.needsAssistance && ` · ${t("needs assistance")}`}
                {asksYouthConvention(member.age) &&
                  member.youthConvention &&
                  ` · ${t("Youth Convention: {answer}", {
                    answer:
                      member.youthConvention === "yes" ? t("Yes") : t("No"),
                  })}`}
                {index === 0 &&
                  values.verifiedInPerson &&
                  ` · ${t("verified in person")}`}
              </span>
              {splitFlights &&
                (() => {
                  const own = ownFlights(member)
                  return (
                    <>
                      {own?.arrival && (
                        <span className="text-2xs/relaxed">
                          <span className="text-muted-foreground">
                            {t("Airport pickup")}:
                          </span>{" "}
                          {formatIndiaFlight(own.arrival, lang)}
                        </span>
                      )}
                      {own?.departure && (
                        <span className="text-2xs/relaxed">
                          <span className="text-muted-foreground">
                            {t("Flight out")}:
                          </span>{" "}
                          {formatIndiaFlight(own.departure, lang)}
                        </span>
                      )}
                    </>
                  )
                })()}
            </li>
          ))}
        </ul>
        {(india?.arrival || india?.departure) && (
          <dl className="divide-y divide-border">
            {india.arrival && (
              <Row label={t("Airport pickup")}>
                {formatIndiaFlight(india.arrival, lang)}
              </Row>
            )}
            {india.departure && (
              <Row label={t("Flight out")}>
                {formatIndiaFlight(india.departure, lang)}
              </Row>
            )}
          </dl>
        )}
      </section>

      <section className="flex flex-col">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-sm font-medium">
            {isLocalMandal(values.mandal)
              ? t("Dates")
              : t("Mahotsav - Stay & Travel")}
          </h3>
          {editButton(2)}
        </div>
        <dl className="divide-y divide-border">
          {sevaks.length > 0 && (
            <Row label={t("Seva")}>
              {values.members.length === 1
                ? t("Arriving early as a Swayam Sevak")
                : t("{names}: arriving early as Swayam Sevaks", {
                    names: sevaks.join(", "),
                  })}
            </Row>
          )}
          {/* What the whole party shares first, then each person's own. */}
          {!splitDates && (
            <>
              <Row label={t("Arriving")}>
                {stayText(
                  values.arrivalDate,
                  values.arrivalSlot,
                  values.arrivalMeal,
                  lang
                )}
              </Row>
              <Row label={t("Leaving")}>
                {stayText(
                  values.departureDate,
                  values.departureSlot,
                  values.departureMeal,
                  lang
                )}
              </Row>
            </>
          )}
          {local ? (
            <Row label={t("Travel and stay")}>{t("Local — not needed")}</Row>
          ) : (
            !splitTravel && (
              <Row label={t("Travel")}>
                <TripSummary trip={values} />
              </Row>
            )
          )}
          {(splitDates || splitTravel) &&
            values.members.map((member, index) => (
              <Row
                key={index}
                label={fullNameOf(member) || t("Person {n}", { n: index + 1 })}
              >
                <span className="flex flex-col gap-1">
                  {splitDates && (
                    <>
                      <span>
                        <span className="text-muted-foreground">
                          {t("Arriving")}:
                        </span>{" "}
                        {stayText(
                          member.arrivalDate,
                          member.arrivalSlot,
                          member.arrivalMeal,
                          lang
                        )}
                      </span>
                      <span>
                        <span className="text-muted-foreground">
                          {t("Leaving")}:
                        </span>{" "}
                        {stayText(
                          member.departureDate,
                          member.departureSlot,
                          member.departureMeal,
                          lang
                        )}
                      </span>
                    </>
                  )}
                  {splitTravel && (
                    <span>
                      {splitDates && (
                        <span className="text-muted-foreground">
                          {t("Travel")}:{" "}
                        </span>
                      )}
                      <TripSummary trip={member} />
                    </span>
                  )}
                </span>
              </Row>
            ))}
          {!local && (
            <>
              {comesByVehicle(values) && (
                <Row label={t("Vehicles")}>
                  {vehicleCount === 1
                    ? t("1 vehicle")
                    : t("{n} vehicles", { n: vehicleCount })}
                  {vehicleNumbers.length > 0 &&
                    ` · ${vehicleNumbers.join(", ")}`}
                </Row>
              )}
              <Row label={t("Accommodation")}>
                {needsAccommodation(values) ? (
                  <>
                    <Badge variant="info" className="align-middle">
                      {t("Needed")}
                    </Badge>
                    {/* Only some of the party: say who. */}
                    {beds.includes(false) && (
                      <span className="ml-2">
                        {t("for {names}", {
                          names: values.members
                            .map((m, i) =>
                              beds[i]
                                ? fullNameOf(m) || t("Person {n}", { n: i + 1 })
                                : ""
                            )
                            .filter(Boolean)
                            .join(", "),
                        })}
                      </span>
                    )}
                  </>
                ) : (
                  t("Not needed")
                )}
              </Row>
            </>
          )}
        </dl>
      </section>

      <div className="flex flex-col gap-1.5">
        <Checkbox
          id="consent"
          label={
            <>
              {t("These details are correct")}
              <RequiredMark />
            </>
          }
          description={t(
            "I agree to follow the Mandir's guidelines during the event."
          )}
          {...register("consent")}
        />
        {errors.consent && (
          <p className="text-2xs/relaxed text-destructive">
            {errors.consent.message}
          </p>
        )}
      </div>
    </div>
  )
}
