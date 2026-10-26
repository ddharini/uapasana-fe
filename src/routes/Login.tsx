import { RiLoader4Line } from "@remixicon/react"
import * as React from "react"
import { Link, Navigate, useNavigate, useSearchParams } from "react-router"

import { Button } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/input"
import { Card, Separator } from "@/components/ui/primitives"
import { EVENT } from "@/config/event"
import { signIn, signUp, useSession } from "@/lib/auth-client"

/** Google's official mark. Four-colour and fixed — their branding terms do not allow recolouring it, so it does not inherit `currentColor` like every other icon here. */
function GoogleMark(props: React.ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  )
}

/**
 * Google hands its failures back as an `?error=` code on the URL it redirects to
 * — there is no response to read, because the browser left the page. These are
 * the codes Better Auth's OAuth callback can emit (see its `redirectOnError`).
 *
 * `account_not_linked` is the one users actually hit, and the only one whose
 * message can tell them what to do instead. It means this Google address already
 * belongs to an account created with a password: Better Auth refuses to merge
 * the two, because an unverified local account claiming an address is exactly
 * how someone would pre-register a victim's email and wait to inherit their
 * Google sign-in. Signing in with the password is the way through.
 */
const OAUTH_ERRORS: Record<string, string> = {
  account_not_linked:
    "That email already has an account with a password. Sign in with your password below.",
  access_denied: "Google sign-in was cancelled.",
  email_not_found: "Google did not share an email address for that account.",
  oauth_provider_not_found: "Google sign-in is not configured on this server.",
  signup_disabled: "That Google account does not have access yet.",
}

/**
 * Where to go after signing in: `?next=` when it is a path on this site, else
 * the dashboard. Only a single leading slash is accepted — `//evil.com` is a
 * protocol-relative URL to another site, and an open redirect on a login page
 * is a phishing kit.
 */
function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/"
}

/**
 * Sign in or sign up.
 *
 * One screen with a toggle rather than two routes: the difference between them
 * is a single field, and a user who picked the wrong one should not have to
 * navigate to fix it. Google covers both cases at once — Better Auth creates the
 * account on first callback — so it sits above the toggle, not inside it.
 */
export function Login() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const next = safeNext(searchParams.get("next"))
  const [mode, setMode] = React.useState<"signin" | "signup">("signin")
  const [name, setName] = React.useState("")
  // `?email=` comes from an invite link, so the invited address is already in.
  const [email, setEmail] = React.useState(searchParams.get("email") ?? "")
  const [password, setPassword] = React.useState("")
  const [formError, setFormError] = React.useState<string>()
  const [busy, setBusy] = React.useState<"email" | "google">()
  const { data: session } = useSession()

  // A failed Google round trip lands back here as /login?error=<code>. Read off
  // the URL while rendering rather than copying it into state from an effect:
  // the URL already *is* this piece of state, and the copy would be a second one
  // to keep in sync. `beginAttempt` drops the parameter when the next attempt
  // starts, so a stale code never outlives the attempt that produced it.
  const oauthError = searchParams.get("error")
  const error =
    formError ??
    (oauthError
      ? (OAUTH_ERRORS[oauthError] ??
        "Could not sign in with Google. Please try again.")
      : undefined)

  /** Clears whichever of the two error sources is currently showing. */
  const beginAttempt = () => {
    setFormError(undefined)
    if (oauthError) {
      // Only the error goes: `next` and `email` still apply to this attempt.
      const params = new URLSearchParams(searchParams)
      params.delete("error")
      setSearchParams(params, { replace: true })
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    beginAttempt()
    setBusy("email")

    const result =
      mode === "signup"
        ? await signUp.email({ name, email, password })
        : await signIn.email({ email, password })

    setBusy(undefined)

    // Better Auth reports failures in the result rather than by throwing, so a
    // missing check here looks like a silent no-op on a wrong password.
    if (result.error) {
      setFormError(result.error.message ?? "Could not sign in.")
      return
    }

    navigate(next)
  }

  const continueWithGoogle = async () => {
    beginAttempt()
    setBusy("google")

    // No `navigate` on the happy path: the client redirects the browser to
    // Google itself, and it is the backend's OAuth callback that sends it back
    // to `callbackURL` with the session cookie already set. `busy` is left on
    // for the same reason — the page is on its way out, and clearing it would
    // flash an idle button over a navigating tab.
    const result = await signIn.social({
      provider: "google",
      callbackURL: `${window.location.origin}${next}`,
      // Keeps `next` through a failed round trip; Google appends `&error=`.
      errorCallbackURL: `${window.location.origin}/login?${new URLSearchParams({ next })}`,
    })

    // Only reached when the request never got as far as Google — the provider
    // is unconfigured, or the API is unreachable. `PROVIDER_NOT_FOUND` is what
    // the server sends when GOOGLE_CLIENT_ID/SECRET are unset, and Better Auth's
    // own wording for it ("Provider not found") reads like a bug in the app
    // rather than a gap in its configuration.
    if (result.error) {
      setBusy(undefined)
      setFormError(
        result.error.code === "PROVIDER_NOT_FOUND"
          ? "Google sign-in is not configured on this server."
          : (result.error.message ??
              "Could not reach Google. Please try again.")
      )
    }
  }

  // Already signed in: nothing to do here.
  if (session) return <Navigate to={next} replace />

  return (
    <div className="flex min-h-svh items-center justify-center px-4 py-6 sm:p-6">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-base font-medium">{EVENT.name}</h1>
          {next.startsWith("/invite/") ? (
            <p className="text-xs/relaxed text-muted-foreground">
              Sign in, or sign up if you are new, to accept your admin invite.
            </p>
          ) : (
            <p className="text-xs/relaxed text-muted-foreground">
              Staff sign in. Devotees register on the{" "}
              <Link to="/register" className="text-primary hover:underline">
                registration form
              </Link>{" "}
              and do not need an account.
            </p>
          )}
        </div>

        <Card>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={continueWithGoogle}
            disabled={busy !== undefined}
          >
            {busy === "google" ? (
              <RiLoader4Line className="animate-spin" />
            ) : (
              <GoogleMark />
            )}
            Continue with Google
          </Button>

          <div className="flex items-center gap-2">
            <Separator className="flex-1" />
            <span className="text-2xs/relaxed text-muted-foreground">
              or
            </span>
            <Separator className="flex-1" />
          </div>

          <form onSubmit={submit} className="flex flex-col gap-4">
            {mode === "signup" && (
              <Field label="Name">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={busy !== undefined}
                  required
                />
              </Field>
            )}

            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={busy !== undefined}
                required
              />
            </Field>

            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                disabled={busy !== undefined}
                required
                minLength={8}
              />
            </Field>

            {error && (
              <p className="text-2xs/relaxed text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" size="sm" disabled={busy !== undefined}>
              {busy === "email" && <RiLoader4Line className="animate-spin" />}
              {mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>
        </Card>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="text-xs/relaxed text-muted-foreground transition-colors hover:text-foreground"
        >
          {mode === "signin"
            ? "Need an account? Sign up"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  )
}
