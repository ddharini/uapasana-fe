import { RiLoader4Line, RiWhatsappLine } from "@remixicon/react"
import * as React from "react"
import { Link, useLocation, useSearchParams } from "react-router"

import { PublicHeader } from "@/components/layout/PublicHeader"
import { Button, buttonVariants } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/input"
import { PhoneInput } from "@/components/ui/phone-input"
import { EmptyState, Skeleton } from "@/components/ui/primitives"
// import { Card, CardTitle } from "@/components/ui/primitives" // paused: room details card
// PAUSED 2026-10-11 — per-person room allotment; the server no longer sends `stay`.
// import { StayDetails } from "@/features/accommodation/paused/components"
import {
  useMyRegistrations,
  useSendOtp,
  useVerifyOtp,
} from "@/features/registrations/api"
import {
  DevCodeNote,
  RegistrationConfirmation,
} from "@/features/registrations/components"
import { RegistrationForm } from "@/features/registrations/form/RegistrationForm"
import type { Registration } from "@/features/registrations/types"
import { useT } from "@/i18n/context"
import { LanguagePicker, LanguageProvider } from "@/i18n/LanguageProvider"
import { serverMessage } from "@/i18n/translate"
import {
  DEFAULT_COUNTRY_CODE,
  asciiDigits,
  formatMobile,
  fromE164,
  mobileError,
  toE164,
} from "@/lib/phone"

type Auth = { mobile: string; token: string }

/** Statuses a devotee can no longer change online, and why. */
const LOCKED: Partial<Record<Registration["status"], string>> = {
  checked_in: "Already checked in — ask at the desk to change anything.",
  cancelled: "Cancelled — contact your mandal sanchalak to restore it.",
}

/**
 * `/register/edit`: a devotee changing a registration they made.
 *
 * No account: the primary contact's number is the key. A code on WhatsApp
 * proves it is theirs, and opens the one registration that number is the
 * contact for, in the same form. The contact number
 * itself is fixed here. A confirmed registration stays confirmed; the change
 * is logged for the admins (Logs screen).
 */
export function EditMyRegistration() {
  return (
    <LanguageProvider>
      <EditMyRegistrationPage />
    </LanguageProvider>
  )
}

function EditMyRegistrationPage() {
  const { t } = useT()
  // Arriving from "Change my registration" on the new-registration form: with
  // a token the number is already verified; without one (the form found it
  // taken before sending a code) it is only filled in.
  const location = useLocation()
  const state = location.state as Partial<Auth> | null
  const fromForm =
    state?.mobile && state.token
      ? { mobile: state.mobile, token: state.token }
      : undefined
  const prefill = !fromForm ? state?.mobile : undefined
  const [auth, setAuth] = React.useState<Auth | undefined>(fromForm)
  const [expired, setExpired] = React.useState(false)
  // With the code it had before, kept at the moment of saving: the list of
  // their registrations may refetch with the new code before this shows.
  const [saved, setSaved] = React.useState<{
    registration: Registration
    previousCode: string
  }>()
  const [, setParams] = useSearchParams()

  // One registration per contact number, so this is it.
  const mine = useMyRegistrations(auth)
  const chosen = mine.data?.[0]

  const startOver = () => {
    setAuth(undefined)
    setParams({}, { replace: true })
  }

  let body: React.ReactNode
  if (saved) {
    body = (
      <RegistrationConfirmation
        registration={saved.registration}
        previousCode={saved.previousCode}
        updated
        actions={
          <Link
            to="/register"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            {t("Back to registration")}
          </Link>
        }
      />
    )
  } else if (!auth) {
    body = (
      <VerifyNumber
        initialMobile={prefill}
        expired={expired}
        onVerified={(next) => {
          setExpired(false)
          setAuth(next)
        }}
      />
    )
  } else if (mine.isPending) {
    body = <Skeleton className="h-40" />
  } else if (mine.isError) {
    body = (
      <EmptyState
        title={t("Could not open your registrations")}
        description={`${serverMessage(t, mine.error.message)} ${t("Verify your number again to continue.")}`}
        action={
          <Button size="lg" onClick={startOver}>
            {t("Verify again")}
          </Button>
        }
      />
    )
  } else if (!chosen) {
    body = (
      <EmptyState
        title={t("No registration under this number")}
        description={t(
          "{mobile} is not the contact number on any registration. It may have been made with another family member's number.",
          { mobile: formatMobile(auth.mobile) }
        )}
        action={
          <Link to="/register" className={buttonVariants({ size: "lg" })}>
            {t("Register now")}
          </Link>
        }
      />
    )
  } else if (LOCKED[chosen.status]) {
    body = (
      <EmptyState
        title={t("{code} cannot be changed online", { code: chosen.code })}
        description={t(LOCKED[chosen.status]!)}
      />
    )
  } else {
    body = (
      <div className="flex flex-col gap-4">
        {/* PAUSED 2026-10-11 — per-person room allotment.
        {chosen.stay && (
          <Card className="gap-3">
            <CardTitle>Where you are staying</CardTitle>
            <StayDetails notice={chosen.stay} />
          </Card>
        )}
        {chosen.stayChanging && (
          <p className="rounded-md bg-amber-500/10 px-3 py-2 text-2xs/relaxed text-amber-800 dark:text-amber-300">
            Your room details are being updated. We will send the new ones on
            WhatsApp.
          </p>
        )}
        */}
        <p className="rounded-md bg-muted px-3 py-2 text-2xs/relaxed text-muted-foreground">
          {(() => {
            const [before, after] = t("Changing {code}.").split("{code}")
            return (
              <>
                {before}
                <span className="font-mono font-medium text-foreground">
                  {chosen.code}
                </span>
                {after}
              </>
            )
          })()}
          {` ${t("The seva team can see what you changed.")}`}
          {/* Paused with per-person allotment:
          {chosen.stay &&
            " Changing dates or people may change your rooms."} */}
        </p>
        <RegistrationForm
          key={chosen.id}
          source="self"
          editing={{ registration: chosen, as: "self", ownerToken: auth.token }}
          onRegistered={(registration) =>
            setSaved({ registration, previousCode: chosen.code })
          }
          onOwnerTokenExpired={() => {
            // The changes stay in this device's draft until they verify again.
            setExpired(true)
            startOver()
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-svh flex-col">
      <PublicHeader
        eyebrow={t("Update your registration")}
        action={<LanguagePicker />}
      >
        <p className="max-w-prose text-xs/relaxed text-muted-foreground">
          {t(
            "Update dates, travel, or the people coming. You need the mobile number given as the contact when you registered."
          )}
        </p>
      </PublicHeader>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 pt-5 pb-8 sm:px-6 sm:py-6">
        {body}
      </main>
    </div>
  )
}

/** The contact number, and a WhatsApp code to prove it is theirs. */
function VerifyNumber({
  initialMobile,
  expired,
  onVerified,
}: {
  initialMobile?: string
  expired: boolean
  onVerified: (auth: Auth) => void
}) {
  const { t } = useT()
  const sendOtp = useSendOtp()
  const verifyOtp = useVerifyOtp()
  const initial = initialMobile ? fromE164(initialMobile) : undefined
  const [country, setCountry] = React.useState<string>(
    initial?.code ?? DEFAULT_COUNTRY_CODE
  )
  const [mobile, setMobile] = React.useState(initial?.national ?? "")
  const [numberError, setNumberError] = React.useState<string>()
  const [sentTo, setSentTo] = React.useState<string>()
  const [code, setCode] = React.useState("")
  const [devCode, setDevCode] = React.useState<string>()

  const e164 =
    mobile && !mobileError(mobile, country)
      ? toE164(country, mobile)
      : undefined

  const send = () => {
    const problem = mobile
      ? mobileError(mobile, country, t)
      : t("Enter the contact number")
    setNumberError(problem)
    if (problem || !e164) return
    sendOtp.mutate(e164, {
      onSuccess: (result) => {
        setSentTo(e164)
        setCode("")
        setDevCode(result.devCode)
      },
    })
  }

  const verify = (value: string) => {
    if (!sentTo || value.length !== 6 || verifyOtp.isPending) return
    verifyOtp.mutate(
      { mobile: sentTo, code: value },
      {
        onSuccess: ({ verificationToken }) =>
          onVerified({ mobile: sentTo, token: verificationToken }),
      }
    )
  }

  const error = (sentTo ? verifyOtp.error : null) ?? sendOtp.error

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (sentTo && sentTo === e164) verify(code)
        else send()
      }}
    >
      {expired && (
        <p className="rounded-md bg-amber-500/10 px-3 py-2 text-2xs/relaxed text-amber-800 dark:text-amber-300">
          {t(
            "Your verification ran out before saving. Verify your number again — the changes you made are kept on this device."
          )}
        </p>
      )}
      <Field label={t("Contact mobile number")} required error={numberError}>
        <PhoneInput
          id="edit-mobile"
          countryCode={country}
          placeholder="9876543210"
          invalid={!!numberError}
          codeProps={{
            value: country,
            onChange: (e) => setCountry(e.target.value),
          }}
          numberProps={{
            value: mobile,
            onChange: (e) => {
              setMobile(e.target.value)
              setNumberError(undefined)
            },
          }}
        />
      </Field>

      {sentTo && sentTo === e164 ? (
        <div className="flex flex-col gap-2">
          <p className="text-2xs/relaxed text-muted-foreground">
            {(() => {
              const [before, after] = t(
                "Enter the code sent on WhatsApp to {mobile}."
              ).split("{mobile}")
              return (
                <>
                  {before}
                  <span className="font-medium text-foreground tabular-nums">
                    {formatMobile(sentTo)}
                  </span>
                  {after}
                </>
              )
            })()}
          </p>
          <div className="flex items-stretch gap-2">
            <Input
              id="edit-otp"
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
                if (digits.length === 6) verify(digits)
              }}
            />
            <Button
              type="submit"
              size="lg"
              disabled={code.length !== 6 || verifyOtp.isPending}
            >
              {verifyOtp.isPending && (
                <RiLoader4Line className="animate-spin" />
              )}
              {t("Verify")}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs/relaxed">
            <button
              type="button"
              onClick={send}
              disabled={sendOtp.isPending}
              className="text-primary hover:underline"
            >
              {t("Resend code")}
            </button>
            {devCode && <DevCodeNote code={devCode} />}
          </div>
        </div>
      ) : (
        <Button
          type="submit"
          size="lg"
          disabled={sendOtp.isPending}
          className="self-start"
        >
          {sendOtp.isPending ? (
            <RiLoader4Line className="animate-spin" />
          ) : (
            <RiWhatsappLine />
          )}
          {t("Send code on WhatsApp")}
        </Button>
      )}

      {error && (
        <p className="text-2xs/relaxed text-destructive">
          {serverMessage(t, error.message)}
        </p>
      )}
    </form>
  )
}
