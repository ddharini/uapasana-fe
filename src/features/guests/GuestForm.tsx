import {
  RiAddLine,
  RiCheckLine,
  RiLoader4Line,
  RiSubtractLine,
} from "@remixicon/react"
import { cn } from "cn"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/choice"
import { DigitsInput, Field, Input, Textarea } from "@/components/ui/input"
import { PhoneInput } from "@/components/ui/phone-input"
import { MandalSelect } from "@/components/MandalSelect"
import { NO_MANDAL, formatStayDate } from "@/config/event"

import {
  GUEST_MEALS,
  MAX_GUESTS_PER_DAY,
  useCreateGuestVisit,
  useUpdateGuestVisit,
  type GuestMeal,
  type GuestVisit,
} from "./api"
import {
  initialValues,
  toInput,
  validate,
  type DayValues,
  type GuestFormErrors,
  type GuestFormValues,
  type GuestHost,
} from "./form"

/** One tickable option card, styled like ChoiceGroup's but with a square box: more than one can be on. */
function CheckCard({
  label,
  checked,
  onChange,
  invalid,
  className,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  invalid?: boolean
  className?: string
}) {
  return (
    <label
      className={cn(
        // White on the tinted day card, so it reads as something to tap.
        "relative flex cursor-pointer items-center gap-3 rounded-md border border-border bg-card p-3.5 transition-colors select-none sm:gap-2.5 sm:p-3",
        "hover:bg-muted/60 has-focus-visible:border-ring has-focus-visible:ring-2 has-focus-visible:ring-ring/30",
        checked && "border-primary ring-1 ring-primary hover:bg-card",
        invalid && !checked && "border-destructive/60",
        className
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span className="min-w-0 flex-1 text-xs/relaxed font-medium">
        {label}
      </span>
      <span
        aria-hidden
        className={cn(
          "flex size-4.5 shrink-0 items-center justify-center rounded-[3px] border border-border sm:size-3.5",
          checked && "border-primary bg-primary text-primary-foreground"
        )}
      >
        {checked && <RiCheckLine className="size-3 sm:size-2.5" />}
      </span>
    </label>
  )
}

/**
 * Lunch and dinner, either or both; or "No mahaprasad", which clears them.
 * One of these has to be ticked, so a skipped question is never read as "no".
 */
function MealPicker({
  day,
  invalid,
  onChange,
}: {
  day: DayValues
  invalid?: boolean
  onChange: (next: Partial<DayValues>) => void
}) {
  const toggle = (meal: GuestMeal, on: boolean) =>
    onChange({
      noMeal: false,
      meals: (Object.keys(GUEST_MEALS) as GuestMeal[]).filter((m) =>
        m === meal ? on : day.meals.includes(m)
      ),
    })
  return (
    <div
      role="group"
      aria-invalid={invalid || undefined}
      className="grid grid-cols-2 gap-2"
    >
      {(Object.keys(GUEST_MEALS) as GuestMeal[]).map((meal) => (
        <CheckCard
          key={meal}
          label={GUEST_MEALS[meal]}
          checked={day.meals.includes(meal)}
          onChange={(on) => toggle(meal, on)}
          invalid={invalid}
        />
      ))}
      <CheckCard
        label="No mahaprasad"
        checked={day.noMeal}
        onChange={(on) => onChange({ noMeal: on, meals: on ? [] : day.meals })}
        invalid={invalid}
        className="col-span-2"
      />
    </div>
  )
}

/** A count with − and + either side, for thumbs. */
function GuestCount({
  id,
  value,
  onChange,
  invalid,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  invalid?: boolean
}) {
  const n = Number(value) || 0
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        className="bg-card"
        aria-label="One fewer"
        disabled={n <= 1}
        onClick={() => onChange(String(n - 1))}
      >
        <RiSubtractLine />
      </Button>
      <DigitsInput
        id={id}
        value={value}
        maxLength={2}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
        className="w-16 bg-card text-center tabular-nums"
      />
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        className="bg-card"
        aria-label="One more"
        disabled={n >= MAX_GUESTS_PER_DAY}
        onClick={() => onChange(String(n + 1))}
      >
        <RiAddLine />
      </Button>
    </div>
  )
}

function DayCard({
  day,
  number,
  errors,
  onChange,
}: {
  day: DayValues
  number: number
  errors: GuestFormErrors
  onChange: (next: Partial<DayValues>) => void
}) {
  const guestsError = errors[`${day.date}.guests`]
  const mealError = errors[`${day.date}.meal`]
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-md border border-border p-3.5 transition-colors sm:p-3",
        day.on && "border-primary bg-primary/5"
      )}
    >
      <Checkbox
        checked={day.on}
        onChange={(e) => onChange({ on: e.target.checked })}
        label={formatStayDate(day.date)}
        description={day.on ? undefined : `Tick if they come on day ${number}`}
      />
      {day.on && (
        <div className="flex flex-col gap-3 pl-8 sm:pl-6">
          <Field label="How many people?" required error={guestsError}>
            <GuestCount
              id={`guests-${day.date}`}
              value={day.guests}
              onChange={(guests) => onChange({ guests })}
              invalid={!!guestsError}
            />
          </Field>
          <Field
            label="Will they take mahaprasad?"
            required
            hint="Tick every meal they will take."
            error={mealError}
          >
            <MealPicker day={day} invalid={!!mealError} onChange={onChange} />
          </Field>
        </div>
      )}
    </div>
  )
}

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`

/** "7 people over 2 days · 7 lunches · 3 dinners", for what is filled in so far. */
function Totals({ days }: { days: DayValues[] }) {
  const on = days.filter((d) => d.on && Number(d.guests) > 0)
  if (on.length === 0) return null
  const sum = (pick: (d: DayValues) => boolean) =>
    on.filter(pick).reduce((total, d) => total + Number(d.guests), 0)
  const lunches = sum((d) => d.meals.includes("lunch"))
  const dinners = sum((d) => d.meals.includes("dinner"))
  return (
    <p className="rounded-md bg-muted px-3 py-2 text-2xs/relaxed text-muted-foreground tabular-nums">
      {on.length === 1
        ? plural(
            sum(() => true),
            "person",
            "people"
          )
        : `${plural(
            sum(() => true),
            "visit"
          )} over ${on.length} days`}
      {" · "}
      {plural(lunches, "lunch", "lunches")} · {plural(dinners, "dinner")}
    </p>
  )
}

/**
 * Walk-in guests: whose they are, the days they come, how many, and which
 * meals they take. Used by hosts on the public link (`audience: "host"`, the
 * host is filling it in) and by the team at the desk.
 *
 * Nothing turns red while it is being filled in; after Submit the errors
 * follow the fields live, so each one clears the moment it is fixed.
 */
export function GuestForm({
  audience,
  visit,
  lockedMandal,
  host,
  onSaved,
}: {
  audience: "host" | "desk"
  /** Editing this entry; a new one otherwise. */
  visit?: GuestVisit
  /** A sanchalak's mandal: preset and fixed. */
  lockedMandal?: string
  /** A new entry's host details, filled in from the last one sent. */
  host?: GuestHost
  onSaved: (visit: GuestVisit) => void
}) {
  const create = useCreateGuestVisit()
  const update = useUpdateGuestVisit()
  const [values, setValues] = React.useState(() =>
    initialValues(visit, lockedMandal, visit ?? host)
  )
  const [submitted, setSubmitted] = React.useState(false)

  const errors = submitted ? validate(values) : {}
  const pending = create.isPending || update.isPending
  const serverError = (create.error ?? update.error)?.message
  const byHost = audience === "host"

  const set = <K extends keyof GuestFormValues>(
    field: K,
    value: GuestFormValues[K]
  ) => setValues((current) => ({ ...current, [field]: value }))

  const setDay = (date: string, next: Partial<DayValues>) =>
    setValues((current) => {
      // A day just ticked starts with the count given for another day: the
      // same party usually comes each time.
      const known = current.days.find((d) => d.on && d.guests)?.guests ?? ""
      return {
        ...current,
        days: current.days.map((d) =>
          d.date !== date
            ? d
            : {
                ...d,
                ...(next.on && !d.guests ? { guests: known } : {}),
                ...next,
              }
        ),
      }
    })

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(validate(values)).length > 0) {
      // The first problem may be off screen on a phone.
      requestAnimationFrame(() =>
        document
          .querySelector("[aria-invalid='true'], [data-error]")
          ?.scrollIntoView({ behavior: "smooth", block: "center" })
      )
      return
    }
    const input = toInput(values)
    if (visit) update.mutate({ ...input, id: visit.id }, { onSuccess: onSaved })
    else create.mutate(input, { onSuccess: onSaved })
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-sm font-medium">
            {byHost ? "Your details" : "Whose guests"}
          </h2>
          <p className="text-2xs/relaxed text-muted-foreground">
            {byHost
              ? "The guests are coming as yours. The team will call this number if they need to."
              : "The devotee who invited them."}
          </p>
        </div>
        <Field
          label={byHost ? "Your name" : "Host's name"}
          required
          error={errors.hostName}
        >
          <Input
            value={values.hostName}
            onChange={(e) => set("hostName", e.target.value)}
            placeholder="Full name"
            maxLength={80}
            autoComplete={byHost ? "name" : "off"}
            aria-invalid={!!errors.hostName}
          />
        </Field>
        <Field
          label={byHost ? "Your mobile" : "Host's mobile"}
          required
          error={errors.hostMobile}
        >
          <PhoneInput
            id="hostMobile"
            countryCode={values.countryCode}
            invalid={!!errors.hostMobile}
            placeholder="98765 43210"
            codeProps={{
              value: values.countryCode,
              onChange: (e) => set("countryCode", e.target.value),
            }}
            numberProps={{
              value: values.hostMobile,
              onChange: (e) => set("hostMobile", e.target.value),
              "aria-invalid": !!errors.hostMobile,
            }}
          />
        </Field>
        <Field
          label={byHost ? "Your mandal" : "Host's mandal"}
          required
          error={errors.hostMandal}
        >
          <MandalSelect
            value={values.hostMandal}
            onChange={(value) => set("hostMandal", value)}
            placeholder="Pick a mandal"
            last={[{ value: NO_MANDAL, label: NO_MANDAL }]}
            disabled={!!lockedMandal}
            invalid={!!errors.hostMandal}
          />
        </Field>
      </section>

      <section
        className="flex flex-col gap-4"
        data-error={errors.days ? true : undefined}
      >
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-sm font-medium">
            When are they coming?
            <span aria-hidden className="ml-0.5 text-destructive">
              *
            </span>
          </h2>
          <p className="text-2xs/relaxed text-muted-foreground">
            Tick each day they come, then say how many people and whether they
            will take mahaprasad, so the kitchen cooks for them.
          </p>
          {errors.days && (
            <p className="text-2xs/relaxed text-destructive">{errors.days}</p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {values.days.map((day, index) => (
            <DayCard
              key={day.date}
              day={day}
              number={index + 1}
              errors={errors}
              onChange={(next) => setDay(day.date, next)}
            />
          ))}
        </div>
        <Totals days={values.days} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-sm font-medium">About the guests</h2>
        <Field
          label="Guests' names"
          hint="Optional. Helps the team welcome them at the gate."
          error={errors.guestNames}
        >
          <Textarea
            value={values.guestNames}
            onChange={(e) => set("guestNames", e.target.value)}
            placeholder="e.g. Ramesh Shah and family"
            maxLength={300}
            aria-invalid={!!errors.guestNames}
          />
        </Field>
        <Field
          label="Anything else?"
          hint="Optional. e.g. an elderly guest who needs a chair."
          error={errors.notes}
        >
          <Textarea
            value={values.notes}
            onChange={(e) => set("notes", e.target.value)}
            maxLength={300}
            aria-invalid={!!errors.notes}
          />
        </Field>
      </section>

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <p className="text-2xs text-muted-foreground">
          <span className="text-destructive">*</span> Required
        </p>
        {submitted && Object.keys(errors).length > 0 && (
          <p className="text-2xs/relaxed text-destructive">
            Some details are missing — they are marked in red above.
          </p>
        )}
        {serverError && (
          <p className="text-2xs/relaxed text-destructive">{serverError}</p>
        )}
        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className="sm:self-end"
        >
          {pending && <RiLoader4Line className="animate-spin" />}
          {visit
            ? "Save changes"
            : byHost
              ? "Send guest details"
              : "Add guests"}
        </Button>
      </div>
    </form>
  )
}
