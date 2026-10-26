import {
  RiCheckboxCircleFill,
  RiErrorWarningLine,
  RiLoader4Line,
  RiWhatsappLine,
} from "@remixicon/react"
import * as React from "react"
import { useFormContext } from "react-hook-form"
import { Link } from "react-router"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/choice"
import { Input } from "@/components/ui/input"
import { useT } from "@/i18n/context"
import { serverMessage } from "@/i18n/translate"
import { asciiDigits, formatMobile } from "@/lib/phone"

import {
  useNumberTaken,
  useRegistrationLookup,
  useSendOtp,
  useVerifyOtp,
} from "../api"
import { DevCodeNote } from "../components"
import { REGISTRATION_STATUSES, type RegistrationSummary } from "../types"
import { useFormOptions } from "./form-options"
import {
  MOBILE_OTP_REQUIRED,
  contactMobile,
  isContactVerified,
  type RegistrationFormValues,
} from "./schema"

/**
 * Confirms the primary contact's mobile, under the number on the People step.
 *
 * - A number already on the registration being edited needs nothing.
 * - A sanchalak or admin at the desk may tick "Verified in person" — for
 *   devotees without WhatsApp, or registering through their sanchalak.
 * - Everyone else gets a 6-digit code on WhatsApp. Verifying stores the number
 *   and the server's token in the form (`verifiedMobile`,
 *   `mobileVerificationToken`); editing the number afterwards asks again.
 *
 * Also warns when the number already has a registration, so a family is not
 * booked twice, as soon as the number is complete — before any code is sent.
 * The desk sees which registration; the public page only that there is one,
 * until a code proves the number is theirs.
 */
export function MobileVerification() {
  const { watch, setValue, trigger, getValues } =
    useFormContext<RegistrationFormValues>()
  const { allowInPerson, atDesk, editingId } = useFormOptions()
  const { t } = useT()
  const [
    members,
    keptMobile,
    verifiedInPerson,
    verifiedMobile,
    token,
    takenMobile,
  ] = watch([
    "members",
    "keptMobile",
    "verifiedInPerson",
    "verifiedMobile",
    "mobileVerificationToken",
    "takenMobile",
  ])

  const sendOtp = useSendOtp()
  const verifyOtp = useVerifyOtp()
  // The number the current code went to. A different number on screen means
  // that code is useless, so the step starts over.
  const [sentTo, setSentTo] = React.useState<string>()
  const [code, setCode] = React.useState("")
  const [devCode, setDevCode] = React.useState<string>()
  const [resendIn, setResendIn] = React.useState(0)
  // What the code check said this number is already registered as.
  const [takenFromOtp, setTakenFromOtp] = React.useState<{
    mobile: string
    registration: RegistrationSummary
  }>()

  const e164 = contactMobile({ members })
  const values = {
    members,
    keptMobile,
    verifiedInPerson,
    verifiedMobile,
    mobileVerificationToken: token,
  }
  const verified = isContactVerified(values)
  const kept = !!e164 && e164 === keptMobile
  const awaitingCode = !!e164 && sentTo === e164 && !verified

  // The desk may look a number up directly. The public page asks only whether
  // it is taken — which registration, and its name, it learns from a verified
  // code. A kept number is this registration's own, so there is nothing to ask.
  const lookup = useRegistrationLookup(
    atDesk && e164 ? e164 : undefined,
    editingId
  )
  const numberTaken = useNumberTaken(
    !atDesk && e164 && !kept ? e164 : undefined
  )
  const otpFound =
    takenFromOtp &&
    takenFromOtp.mobile === e164 &&
    takenFromOtp.registration.id !== editingId
      ? takenFromOtp.registration
      : undefined
  // One registration per contact number: the one this number already has.
  const taken = atDesk ? lookup.data?.[0] : otpFound
  // Public page: taken, but whose is not for us to say. Read from the form, so
  // a submit that lost the race to another registration lands here too.
  const takenUnnamed = !atDesk && !taken && !!e164 && takenMobile === e164

  // Recorded in the form, so the schema blocks Continue on this number. At
  // the desk the lookup is live, so it also clears when the number changes.
  React.useEffect(() => {
    if (!atDesk || !e164 || !lookup.isSuccess) return
    const found = lookup.data[0]
    if (found) {
      setValue("takenMobile", e164)
      setValue("takenCode", found.code)
    } else if (getValues("takenMobile") === e164) {
      setValue("takenMobile", "")
      setValue("takenCode", "")
    }
  }, [atDesk, e164, lookup.isSuccess, lookup.data, setValue, getValues])

  // The same for the public page's yes-or-no check, leaving alone what a
  // verified code found.
  React.useEffect(() => {
    if (atDesk || !e164 || !numberTaken.isSuccess) return
    if (numberTaken.data.taken) {
      if (getValues("takenMobile") === e164) return
      setValue("takenMobile", e164)
      setValue("takenCode", "")
    } else if (
      getValues("takenMobile") === e164 &&
      takenFromOtp?.mobile !== e164
    ) {
      setValue("takenMobile", "")
      setValue("takenCode", "")
    }
  }, [
    atDesk,
    e164,
    numberTaken.isSuccess,
    numberTaken.data,
    takenFromOtp,
    setValue,
    getValues,
  ])

  React.useEffect(() => {
    if (resendIn <= 0) return
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendIn])

  const send = () => {
    if (!e164) return
    verifyOtp.reset()
    sendOtp.mutate(e164, {
      onSuccess: (result) => {
        setSentTo(e164)
        setCode("")
        setDevCode(result.devCode)
        setResendIn(result.resendAfterSeconds)
      },
    })
  }

  const verify = (value: string) => {
    if (!e164 || value.length !== 6 || verifyOtp.isPending) return
    verifyOtp.mutate(
      { mobile: e164, code: value },
      {
        onSuccess: ({ verificationToken, existing: found }) => {
          setValue("verifiedMobile", e164)
          setValue("mobileVerificationToken", verificationToken)
          const already = found.find((r) => r.id !== editingId)
          if (already) {
            setTakenFromOtp({ mobile: e164, registration: already })
            setValue("takenMobile", e164)
            setValue("takenCode", already.code)
          }
          setSentTo(undefined)
          setDevCode(undefined)
          // Clears a "verify this number" error already showing.
          if (getValues("members.0.mobile")) void trigger("members.0.mobile")
        },
      }
    )
  }

  // Nothing to verify until the number itself is valid; its own field says why.
  if (!e164) return null

  // Taken: nothing to verify — this number cannot register again.
  if (taken || takenUnnamed) {
    return (
      <AlreadyRegistered
        registration={taken}
        atDesk={atDesk}
        mobile={e164}
        token={verifiedMobile === e164 ? token : undefined}
      />
    )
  }

  // Codes switched off for now: nothing to confirm.
  if (!MOBILE_OTP_REQUIRED) return null

  if (kept) {
    return (
      <p className="-mt-1 flex items-center gap-1.5 text-2xs/relaxed text-muted-foreground">
        <RiCheckboxCircleFill className="size-4 shrink-0 text-primary" />
        {t("The contact number on this registration — no new code needed.")}
      </p>
    )
  }

  if (verified && !verifiedInPerson) {
    return (
      <p className="-mt-1 flex items-center gap-1.5 text-2xs/relaxed font-medium text-primary">
        <RiCheckboxCircleFill className="size-4 shrink-0" />
        {t("{mobile} verified", { mobile: formatMobile(e164) })}
      </p>
    )
  }

  const error = (awaitingCode ? verifyOtp.error : null) ?? sendOtp.error

  return (
    <div className="flex flex-col gap-2.5">
      {allowInPerson && (
        // Sanchalaks and admins only: the person is in front of them, or has
        // no WhatsApp to receive a code on.
        <Checkbox
          id="verifiedInPerson"
          label="Verified in person"
          description="You know this person and their number — for anyone without WhatsApp. Recorded with your name."
          checked={verifiedInPerson}
          onChange={(event) => {
            setValue("verifiedInPerson", event.target.checked)
            if (getValues("members.0.mobile")) void trigger("members.0.mobile")
          }}
        />
      )}

      {!verifiedInPerson && (
        <div className="flex flex-col gap-2.5 rounded-md bg-muted/60 p-3">
          {!awaitingCode ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-2xs/relaxed text-muted-foreground">
                {t(
                  "We send a 6-digit code on WhatsApp to confirm this number belongs to the contact."
                )}
              </p>
              <Button
                type="button"
                size="lg"
                onClick={send}
                // Until we know the number is free: a code to a taken number
                // can only end in "already registered".
                disabled={sendOtp.isPending || numberTaken.isLoading}
                className="shrink-0"
              >
                {sendOtp.isPending || numberTaken.isLoading ? (
                  <RiLoader4Line className="animate-spin" />
                ) : (
                  <RiWhatsappLine />
                )}
                {t("Send code")}
              </Button>
            </div>
          ) : (
            <>
              <p className="text-2xs/relaxed text-muted-foreground">
                {(() => {
                  const [before, after] = t(
                    "Enter the code sent on WhatsApp to {mobile}."
                  ).split("{mobile}")
                  return (
                    <>
                      {before}
                      <span className="font-medium text-foreground tabular-nums">
                        {formatMobile(e164)}
                      </span>
                      {after}
                    </>
                  )
                })()}
              </p>
              <div className="flex items-stretch gap-2">
                <Input
                  id="otp-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder={t("6-digit code")}
                  maxLength={6}
                  value={code}
                  aria-label={t("Verification code")}
                  aria-invalid={!!verifyOtp.error}
                  className="max-w-40 tracking-[0.3em] tabular-nums placeholder:tracking-normal"
                  autoFocus
                  onChange={(event) => {
                    const digits = asciiDigits(event.target.value)
                      .replace(/\D/g, "")
                      .slice(0, 6)
                    setCode(digits)
                    verifyOtp.reset()
                    // Six digits is a complete code: check it without another tap.
                    if (digits.length === 6) verify(digits)
                  }}
                  onKeyDown={(event) => {
                    // Enter here means "check this code", not "Continue to the next step".
                    if (event.key === "Enter") {
                      event.preventDefault()
                      verify(code)
                    }
                  }}
                />
                <Button
                  type="button"
                  size="lg"
                  onClick={() => verify(code)}
                  disabled={code.length !== 6 || verifyOtp.isPending}
                >
                  {verifyOtp.isPending && (
                    <RiLoader4Line className="animate-spin" />
                  )}
                  {t("Verify")}
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs/relaxed text-muted-foreground">
                {resendIn > 0 ? (
                  <span className="tabular-nums">
                    {t("Resend in {n}s", { n: resendIn })}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={send}
                    disabled={sendOtp.isPending}
                    className="text-primary hover:underline disabled:opacity-50"
                  >
                    {t("Resend code")}
                  </button>
                )}
                {devCode && (
                  // Only sent by a development server without WhatsApp set up.
                  <DevCodeNote code={devCode} />
                )}
              </div>
            </>
          )}

          {error && (
            <p className="text-2xs/relaxed text-destructive">
              {serverMessage(t, error.message)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * One registration per contact number: this number already has one, so this
 * form cannot be submitted with it. Points to changing that registration
 * instead — or, at the desk, to using a different family member's number.
 *
 * Without `registration` (the public page, before a code), it says only that
 * the number is taken; the edit page verifies the number and opens it.
 */
function AlreadyRegistered({
  registration: r,
  atDesk,
  mobile,
  token,
}: {
  registration?: RegistrationSummary
  atDesk: boolean
  mobile: string
  token?: string
}) {
  const { t } = useT()
  return (
    <div className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-2xs/relaxed">
      <p className="flex items-start gap-1.5 font-medium text-destructive">
        <RiErrorWarningLine className="mt-px size-3.5 shrink-0" />
        {t("{mobile} is already registered", { mobile: formatMobile(mobile) })}
      </p>
      {r && (
        <p className="text-foreground">
          <span className="font-mono font-medium">{r.code}</span> · {r.name} ·{" "}
          {r.people === 1 ? t("1 person") : t("{n} people", { n: r.people })} ·{" "}
          {t(REGISTRATION_STATUSES[r.status])}
          {atDesk && ` · ${r.mandal}`}
        </p>
      )}
      <p className="text-muted-foreground">
        {t("Each contact number has one registration.")}{" "}
        {atDesk
          ? "Change that registration instead, or use another family member's number as the contact."
          : t(
              "To add people or change dates, change that registration instead."
            )}
      </p>
      {atDesk ? (
        r?.id ? (
          <Link
            to={`/registrations/${r.id}`}
            className="self-start font-medium text-primary hover:underline"
          >
            Open {r.code}
          </Link>
        ) : (
          r && (
            <p className="text-muted-foreground">
              It belongs to {r.mandal}; ask an admin to change it.
            </p>
          )
        )
      ) : (
        // With a token the edit page opens it straight away; without one it
        // starts on this number and sends the code.
        <Link
          to="/register/edit"
          state={token ? { mobile, token } : { mobile }}
          className="self-start font-medium text-primary hover:underline"
        >
          {t("Change my registration")}
        </Link>
      )}
    </div>
  )
}
