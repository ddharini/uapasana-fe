import { zodResolver } from "@hookform/resolvers/zod"
import {
  RiArrowLeftLine,
  RiArrowRightLine,
  RiCheckLine,
  RiCloseLine,
  RiLoader4Line,
  RiRestartLine,
} from "@remixicon/react"
import { cn } from "cn"
import * as React from "react"
import {
  FormProvider,
  get,
  type FieldErrors,
  useForm,
  useWatch,
  type Path,
} from "react-hook-form"
import { useSearchParams } from "react-router"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog"
import { isLocalMandal } from "@/config/event"
import { useT } from "@/i18n/context"
import { serverMessage } from "@/i18n/translate"
import { ApiError } from "@/lib/api"

import {
  useCreateRegistration,
  useUpdateOwnRegistration,
  useUpdateRegistration,
} from "../api"
import type { Registration } from "../types"
import { clearDraft, hasContent, loadDraft, saveDraft } from "./draft"
import { FormOptionsContext, type FormOptions } from "./form-options"
import { errorPaths, keepErrorsFresh } from "./fresh-errors"
import { MembersStep } from "./MembersStep"
import { PartyStep } from "./PartyStep"
import { ReviewStep } from "./ReviewStep"
import {
  DEFAULT_VALUES,
  contactMobile,
  fromRegistration,
  makeRegistrationFormSchema,
  relatedFields,
  stepFieldPaths,
  toNewRegistration,
  type RegistrationFormValues,
} from "./schema"
import { StayTravelStep } from "./StayTravelStep"

const STEPS = [
  { title: "Registration" },
  { title: "People" },
  { title: "Mahotsav - Stay & Travel" },
  { title: "Review" },
] as const

/**
 * The registration wizard, used both by devotees on the public page and by
 * staff at the desk. `source` records which of the two filled it in.
 *
 * Four short steps rather than one long page: most people fill this on a phone,
 * and a family of six is a lot of fields to scroll past to find the one error.
 */
/**
 * Moves to and focuses the first field showing an error, in screen order —
 * including choice cards and the phone field, which a plain focus() call
 * misses. False when no field on screen shows one.
 */
function focusFirstError(root: HTMLElement | null) {
  const invalid = root?.querySelector<HTMLElement>('[aria-invalid="true"]')
  if (!invalid) return false
  const focusable = invalid.matches("input, select, textarea, button")
    ? invalid
    : invalid.querySelector<HTMLElement>("input, select, textarea, button")
  invalid.scrollIntoView({ behavior: "smooth", block: "center" })
  focusable?.focus({ preventScroll: true })
  return true
}

/**
 * The registration wizard: devotees on the public page, the team at the desk,
 * and editing a saved registration — by the team, or by the devotee after an
 * OTP. `source` records who filled it in.
 *
 * Four short steps rather than one long page: most people fill this on a phone,
 * and a family of six is a lot of fields to scroll past to find the one error.
 * The step is in the address (`?step=2`), so the browser's Back button goes to
 * the previous step rather than leaving the form.
 */
export function RegistrationForm({
  source,
  onRegistered,
  editing,
  allowInPerson = false,
  lockedMandal,
  onOwnerTokenExpired,
}: {
  source: Registration["source"]
  onRegistered: (registration: Registration) => void
  /** Editing a saved registration rather than making a new one. */
  editing?: {
    registration: Registration
    as: "desk" | "self"
    ownerToken?: string
  }
  /** A sanchalak or admin: may tick "Verified in person" instead of an OTP. */
  allowInPerson?: boolean
  /** A sanchalak's mandal: fixed, and the only one they register for. */
  lockedMandal?: string
  /** A devotee's edit whose OTP ran out before saving: verify again. */
  onOwnerTokenExpired?: () => void
}) {
  const mode: FormOptions["mode"] = !editing
    ? "new"
    : editing.as === "desk"
      ? "edit-desk"
      : "edit-self"
  const draftKey = editing ? `edit-${editing.registration.id}` : source

  // Where the form starts: empty (with a sanchalak's mandal filled in), or the
  // saved registration being edited. "Clear" goes back here.
  const [baseline] = React.useState<RegistrationFormValues>(() =>
    editing
      ? fromRegistration(editing.registration)
      : lockedMandal
        ? { ...DEFAULT_VALUES, mandal: lockedMandal }
        : DEFAULT_VALUES
  )
  // Whatever was entered before a refresh, read once on mount. See draft.ts.
  const [restored] = React.useState(() => loadDraft(draftKey))
  const [filled, setFilled] = React.useState(
    () => !!restored && hasContent(restored.values, baseline)
  )
  const [showRestored, setShowRestored] = React.useState(filled)
  const [confirmClear, setConfirmClear] = React.useState(false)
  // Steps where Continue (or Submit) has been pressed. Until then a step shows
  // no errors at all — only the red stars on what is required.
  const [attempted, setAttempted] = React.useState<number[]>([])
  const markAttempted = (index: number) =>
    setAttempted((steps) => (steps.includes(index) ? steps : [...steps, index]))

  // The step lives in the address. `reached` stops a link or a history entry
  // from skipping steps that were never filled in; an edit starts with every
  // step open.
  const [params, setParams] = useSearchParams()
  const [reached, setReached] = React.useState(
    restored?.reached ?? (editing ? STEPS.length - 1 : 0)
  )
  const urlStep = Number(params.get("step"))
  const step =
    Number.isInteger(urlStep) && urlStep >= 1
      ? Math.min(urlStep - 1, reached)
      : (restored?.step ?? 0)

  const { t, lang } = useT()
  // The rules are the same in every language; only their messages differ.
  const schema = React.useMemo(() => makeRegistrationFormSchema(lang), [lang])

  const topRef = React.useRef<HTMLDivElement>(null)
  const formRef = React.useRef<HTMLFormElement>(null)

  // Problems a check found that no field on screen shows. A rule and the
  // screen agreeing is what keeps this empty; when they ever disagree, the
  // person reads what is wrong instead of pressing a button that does nothing.
  const [unshown, setUnshown] = React.useState<string[]>([])

  const createRegistration = useCreateRegistration()
  const updateAtDesk = useUpdateRegistration(editing?.registration.id ?? "")
  const updateOwn = useUpdateOwnRegistration(editing?.registration.id ?? "")
  const saving =
    mode === "new"
      ? createRegistration
      : mode === "edit-desk"
        ? updateAtDesk
        : updateOwn

  const form = useForm<RegistrationFormValues>({
    resolver: zodResolver(schema),
    defaultValues: restored
      ? {
          ...restored.values,
          ...(lockedMandal ? { mandal: lockedMandal } : {}),
        }
      : baseline,
    // Nothing is checked while a step is being filled in: Continue checks the
    // whole step. From then on keepErrorsFresh (below) keeps those errors
    // current as the user fixes them.
    mode: "onSubmit",
    reValidateMode: "onChange",
  })

  /** What Continue checks on `step`: only what that step shows. */
  const checkedPaths = (index: number) =>
    stepFieldPaths(index, form.getValues()) as Path<RegistrationFormValues>[]

  // Re-checks fields showing an error, so none outlives its cause. On a step
  // where Continue has been pressed, also the fields whose rules read the one
  // that changed, so a new conflict shows at once; before that, nothing turns
  // red. See fresh-errors.ts.
  const live = attempted.includes(step)
  React.useEffect(
    () => keepErrorsFresh(form, live ? relatedFields : undefined),
    [form, live]
  )

  // Errors on screen are in the language they were found in: switching
  // language checks the step again, so they come back in the new one.
  const lastLang = React.useRef(lang)
  React.useEffect(() => {
    if (lastLang.current === lang) return
    lastLang.current = lang
    if (attempted.includes(step))
      void form.trigger(
        stepFieldPaths(step, form.getValues()) as Path<RegistrationFormValues>[]
      )
  }, [lang, attempted, step, form])

  /**
   * Keeps the draft in step with the form: saved a moment after typing stops
   * (not on every keystroke), and at once when the step changes, so a refresh
   * comes back to the same step. A form back where it started leaves no draft.
   */
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const persist = (values: RegistrationFormValues) => {
      if (hasContent(values, baseline))
        saveDraft(draftKey, { values, step, reached })
      else clearDraft(draftKey)
    }
    persist(form.getValues())
    const unsubscribe = form.subscribe({
      formState: { values: true },
      callback: ({ values }) => {
        setFilled(hasContent(values, baseline))
        clearTimeout(timer)
        timer = setTimeout(() => persist(values), 300)
      },
    })
    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
  }, [form, draftKey, baseline, step, reached])

  /** Back to where the form started, with nothing left in storage. */
  const clearForm = () => {
    clearDraft(draftKey)
    form.reset(baseline)
    saving.reset()
    setFilled(false)
    setAttempted([])
    setConfirmClear(false)
    if (!editing) setReached(0)
    goTo(0)
  }

  const goTo = (next: number) => {
    setShowRestored(false)
    setUnshown([])
    setReached((current) => Math.max(current, next))
    setParams((current) => {
      const updated = new URLSearchParams(current)
      updated.set("step", String(next + 1))
      return updated
    })
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  /** Every field path showing an error that step `index` owns (all of them without one). */
  const errorsOn = (
    index?: number,
    errors: FieldErrors<RegistrationFormValues> = form.formState.errors
  ) => {
    const all = errorPaths(errors)
    if (index === undefined) return all
    const owned = stepFieldPaths(index, form.getValues())
    return all.filter((path) =>
      owned.some(
        (own) =>
          path === own ||
          path.startsWith(`${own}.`) ||
          (own === "members.root" && path === "members")
      )
    )
  }

  /**
   * After a check fails: wait for the errors to render, then go to the first.
   * If none is on screen, list what was found under the form instead.
   */
  const showFirstError = (index?: number) =>
    setTimeout(() => {
      if (focusFirstError(formRef.current)) return
      const messages = errorsOn(index).map((path) => {
        const error = get(form.formState.errors, path)
        return (error?.message ?? error?.root?.message) as string | undefined
      })
      setUnshown([...new Set(messages.filter((m): m is string => !!m))])
    }, 50)

  const next = async () => {
    markAttempted(step)
    const valid = await form.trigger(checkedPaths(step))
    if (valid) goTo(step + 1)
    else showFirstError(step)
  }

  // Built when the form is submitted rather than during render: the handler
  // can call `goTo`, which touches a ref.
  const submit = () => {
    markAttempted(step)
    return form.handleSubmit(async (values) => {
      const payload = toNewRegistration(values, source)
      try {
        const registration = await saving.mutateAsync(
          // A devotee's edit is proven by the OTP they started with.
          mode === "edit-self"
            ? { ...payload, mobileVerificationToken: editing?.ownerToken }
            : payload
        )
        // Saved: the draft has done its job.
        clearDraft(draftKey)
        onRegistered(registration)
      } catch (error) {
        // Someone registered this number since the form checked it. One
        // registration per number: back to the number to say so.
        if (error instanceof ApiError && error.code === "ALREADY_REGISTERED") {
          const contact = contactMobile(values)
          if (contact) {
            form.setValue("takenMobile", contact)
            form.setValue(
              "takenCode",
              error.message.match(/DM-(?:F-)?\d+/)?.[0] ??
                t("another registration")
            )
          }
          markAttempted(1)
          goTo(1)
          form.setError("members.0.mobile", {
            message: serverMessage(t, error.message),
          })
          saving.reset()
          return
        }
        if (error instanceof ApiError && error.code === "MOBILE_NOT_VERIFIED") {
          if (mode === "edit-self") {
            // Their OTP ran out. The draft keeps the changes for when they
            // come back verified.
            onOwnerTokenExpired?.()
            return
          }
          // The verification is spent or older than two hours. Back to the
          // number, with the old proof cleared, for a new code.
          form.setValue("verifiedMobile", "")
          form.setValue("mobileVerificationToken", "")
          markAttempted(1)
          goTo(1)
          form.setError("members.0.mobile", {
            message: t(
              "Verification expired. Send a new code to confirm this number."
            ),
          })
          saving.reset()
        }
        // Anything else is shown below the form from `saving.error`.
      }
    }, onInvalid)()
  }

  /**
   * Submit found a problem. The step bar lets someone jump ahead after
   * changing an earlier step, so it may not be on Review: go back to the first
   * step that has one, where its field is on screen.
   */
  const onInvalid = (errors: FieldErrors<RegistrationFormValues>) => {
    // From handleSubmit: formState has not re-rendered with them yet.
    const first = STEPS.findIndex(
      (_, index) => errorsOn(index, errors).length > 0
    )
    if (first !== -1 && first !== step) {
      markAttempted(first)
      goTo(first)
    }
    showFirstError(first === -1 ? undefined : first)
  }

  const isLast = step === STEPS.length - 1
  // A nearby mandal is not asked about travel or stay: step 3 is just dates.
  const local = isLocalMandal(
    useWatch({ control: form.control, name: "mandal" })
  )
  const titleOf = (index: number) =>
    t(index === 2 && local ? "Dates" : STEPS[index].title)

  const editingText = mode !== "new"

  return (
    <FormOptionsContext.Provider
      value={{
        mode,
        allowInPerson,
        lockedMandal,
        editingId: editing?.registration.id,
        savedMembers: editing?.registration.members,
        atDesk: source === "staff",
      }}
    >
      <FormProvider {...form}>
        <div ref={topRef} className="flex scroll-mt-20 flex-col gap-5">
          <ol
            className="-my-2 grid grid-cols-4 gap-1.5 sm:-my-1 sm:gap-2"
            aria-label={t("Registration steps")}
          >
            {STEPS.map((item, index) => {
              const done = index < step
              const current = index === step
              // Any step already reached can be jumped to.
              const reachable = index <= reached && !current
              return (
                <li key={item.title} className="flex">
                  {/* The whole segment — bar and label — is the target, with
                      some padding so the bar alone is tappable on phones. */}
                  <button
                    type="button"
                    disabled={!reachable}
                    onClick={() => goTo(index)}
                    aria-current={current ? "step" : undefined}
                    className={cn(
                      "group flex w-full flex-col gap-1.5 rounded-sm py-2 text-left text-2xs/tight text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:py-1",
                      current && "font-medium text-foreground",
                      reachable && "cursor-pointer hover:text-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "h-1 w-full rounded-full bg-muted transition-colors",
                        (done || current) && "bg-primary",
                        reachable && "group-hover:opacity-80"
                      )}
                    />
                    <span className="sr-only items-center gap-1 sm:not-sr-only sm:flex">
                      {done && (
                        <RiCheckLine className="size-3 shrink-0 text-primary" />
                      )}
                      {titleOf(index)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>

          <div className="flex items-start justify-between gap-3">
            <h2 className="flex min-w-0 flex-wrap items-baseline gap-x-2 font-heading text-base font-medium">
              {titleOf(step)}
              <span className="font-mono text-xs font-normal text-muted-foreground tabular-nums">
                {t("Step {n} of {total}", {
                  n: step + 1,
                  total: STEPS.length,
                })}
              </span>
            </h2>
            {filled && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmClear(true)}
                className="shrink-0 text-muted-foreground"
              >
                <RiRestartLine />
                {editingText ? t("Discard changes") : t("Clear form")}
              </Button>
            )}
          </div>

          {showRestored && (
            <div className="-mt-1 flex items-start justify-between gap-2 rounded-md bg-muted px-3 py-2">
              <p className="text-2xs/relaxed text-muted-foreground">
                {(() => {
                  // The button's name sits mid-sentence, where each language
                  // puts it.
                  const [before, after] = (
                    editingText
                      ? t(
                          "Your unsaved changes were kept on this device. Use {action} to go back to what is saved."
                        )
                      : t(
                          "Picked up where you left off — what you entered was saved on this device. Use {action} to start again."
                        )
                  ).split("{action}")
                  return (
                    <>
                      {before}
                      <span className="font-medium text-foreground">
                        {editingText ? t("Discard changes") : t("Clear form")}
                      </span>
                      {after}
                    </>
                  )
                })()}
              </p>
              <button
                type="button"
                onClick={() => setShowRestored(false)}
                aria-label={t("Dismiss")}
                className="-m-1 rounded-sm p-1 text-muted-foreground hover:text-foreground"
              >
                <RiCloseLine className="size-3.5" />
              </button>
            </div>
          )}

          <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
            <DialogContent>
              <DialogHeader
                title={
                  editingText
                    ? t("Discard your changes?")
                    : t("Clear the form?")
                }
                description={
                  editingText
                    ? t("The registration goes back to how it is saved.")
                    : t(
                        "Everything entered in all four steps is removed, and you start again from step 1."
                      )
                }
              />
              <DialogFooter>
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => setConfirmClear(false)}
                >
                  {t("Keep editing")}
                </Button>
                <Button variant="destructive" size="lg" onClick={clearForm}>
                  {editingText ? t("Discard changes") : t("Clear form")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <form
            ref={formRef}
            onSubmit={(event) => {
              event.preventDefault()
              if (isLast) void submit()
              else void next()
            }}
            className="flex flex-col gap-6"
            noValidate
          >
            {step === 0 && <PartyStep />}
            {step === 1 && <MembersStep />}
            {step === 2 && <StayTravelStep />}
            {step === 3 && <ReviewStep onEditStep={goTo} />}

            {unshown.length > 0 && (
              <div
                role="alert"
                className="rounded-md bg-destructive/10 px-3 py-2 text-2xs/relaxed text-destructive"
              >
                <p className="font-medium">
                  {t("Please fix these before continuing:")}
                </p>
                <ul className="list-disc pl-4">
                  {unshown.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </div>
            )}

            {saving.isError && (
              <p className="text-2xs/relaxed text-destructive">
                {/* A 4xx carries the server's own reason (a rule the form
                  missed); anything else is the network or the server. */}
                {saving.error instanceof ApiError && saving.error.status < 500
                  ? t("The registration could not be saved: {reason}", {
                      reason: serverMessage(t, saving.error.message),
                    })
                  : t(
                      "The registration could not be saved. Check your connection and submit again."
                    )}
              </p>
            )}

            {/*
            Pinned to the bottom of the screen on phones, above the staff tab
            bar when there is one, so Continue is always under the thumb
            instead of below a family's worth of fields.
          */}
            <div className="sticky bottom-(--bottom-nav-h) z-20 -mx-4 flex items-center justify-between gap-2 border-t border-border bg-background/95 px-4 pt-2 pb-[calc(0.5rem+var(--bottom-safe))] backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:pt-4 sm:pb-0 sm:backdrop-blur-none">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => goTo(step - 1)}
                disabled={step === 0 || form.formState.isSubmitting}
              >
                <RiArrowLeftLine />
                {t("Back")}
              </Button>
              <Button
                type="submit"
                size="lg"
                disabled={form.formState.isSubmitting}
                className="flex-1 sm:flex-none"
              >
                {form.formState.isSubmitting && (
                  <RiLoader4Line className="animate-spin" />
                )}
                {isLast
                  ? editingText
                    ? t("Save changes")
                    : t("Submit registration")
                  : t("Continue")}
                {!isLast && <RiArrowRightLine />}
              </Button>
            </div>
          </form>
        </div>
      </FormProvider>
    </FormOptionsContext.Provider>
  )
}
