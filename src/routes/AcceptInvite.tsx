import {
  RiErrorWarningLine,
  RiLoader4Line,
  RiLogoutBoxRLine,
  RiShieldUserLine,
} from "@remixicon/react"
import { useQueryClient } from "@tanstack/react-query"
import * as React from "react"
import { Link, useParams } from "react-router"

import { Button, buttonVariants } from "@/components/ui/button"
import { Card, Skeleton } from "@/components/ui/primitives"
import { EVENT } from "@/config/event"
import {
  useAcceptInvite,
  useInvite,
  type InviteStatus,
} from "@/features/admin/api"
import { signOut, useSession } from "@/lib/auth-client"

const CLOSED: Record<
  Exclude<InviteStatus, "pending">,
  { title: string; body: string }
> = {
  accepted: {
    title: "Invite already used",
    body: "This link has already been accepted. If that was you, sign in to continue.",
  },
  revoked: {
    title: "Invite cancelled",
    body: "This invite was cancelled. Ask the admin who invited you for a new link.",
  },
  expired: {
    title: "Invite expired",
    body: "Invite links last 7 days. Ask the admin who invited you for a new one.",
  },
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center px-4 py-8">
      <Card className="w-full max-w-sm items-center gap-4 py-8 text-center">
        {children}
      </Card>
    </div>
  )
}

function Message({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="font-heading text-base font-medium text-balance">
        {title}
      </h1>
      <p className="text-xs/relaxed text-muted-foreground">{body}</p>
    </div>
  )
}

/**
 * Where an admin invite link lands: `/invite/:token`.
 *
 * Public, because the person opening it may not have an account yet. Signing in
 * goes through the normal login screen and comes back here (`?next=`), and only
 * then is the invite accepted — accepting is always an explicit tap, never a
 * side effect of opening a link.
 */
export function AcceptInvite() {
  const { token = "" } = useParams()
  const queryClient = useQueryClient()
  const invite = useInvite(token)
  const { data: session, isPending: sessionPending } = useSession()
  const accept = useAcceptInvite(token)
  const [signingOut, setSigningOut] = React.useState(false)

  const here = `/invite/${token}`

  if (invite.isPending || sessionPending) {
    return (
      <Shell>
        <Skeleton className="size-8 rounded-full" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-12 w-full" />
      </Shell>
    )
  }

  if (invite.isError) {
    return (
      <Shell>
        <RiErrorWarningLine className="size-8 text-destructive" />
        <Message
          title="Could not open this invite"
          body={`${invite.error.message} Check your connection and try again.`}
        />
        <Button
          size="lg"
          className="w-full"
          onClick={() => void invite.refetch()}
        >
          Try again
        </Button>
      </Shell>
    )
  }

  if (!invite.data) {
    return (
      <Shell>
        <RiErrorWarningLine className="size-8 text-muted-foreground" />
        <Message
          title="Invite link not valid"
          body="Check that the whole link was copied, or ask the admin who invited you to send it again."
        />
      </Shell>
    )
  }

  const data = invite.data

  if (data.status !== "pending") {
    return (
      <Shell>
        <RiErrorWarningLine className="size-8 text-muted-foreground" />
        <Message {...CLOSED[data.status]} />
        <Link
          to="/"
          className={buttonVariants({
            variant: "outline",
            size: "lg",
            className: "w-full",
          })}
        >
          Continue
        </Link>
      </Shell>
    )
  }

  const wrongAccount =
    !!session &&
    data.channel === "email" &&
    data.email !== session.user.email.toLowerCase()

  // Back here after signing in, with the invited email already filled in.
  const loginHref = `/login?${new URLSearchParams({ next: here, ...(data.email ? { email: data.email } : {}) })}`

  const switchAccount = async () => {
    setSigningOut(true)
    await signOut()
    queryClient.clear()
    // A full load rather than navigate(): the session hook needs to start
    // from nothing, and this page should pick up the signed-out state cleanly.
    window.location.assign(loginHref)
  }

  return (
    <Shell>
      <RiShieldUserLine className="size-8 text-primary" />
      <Message
        title={data.name ? `${data.name}, you're invited` : "You're invited"}
        body={
          <>
            {data.invitedByName} has invited you to join{" "}
            <span className="font-medium text-foreground">{EVENT.name}</span> as{" "}
            {data.role === "sanchalak" ? (
              <>
                <span className="font-medium text-foreground">
                  Mandal sanchalak for {data.mandal}
                </span>
                . You will register and update your mandal's devotees.
              </>
            ) : (
              <>
                <span className="font-medium text-foreground">an admin</span>.
                Admins manage registrations and can invite others.
              </>
            )}
          </>
        }
      />

      {!session ? (
        <div className="flex w-full flex-col gap-2">
          <p className="text-2xs/relaxed text-muted-foreground">
            {data.channel === "email"
              ? `Sign in or create an account with ${data.email} to accept.`
              : "Sign in, or create an account if you do not have one, to accept."}
          </p>
          <Link
            to={loginHref}
            className={buttonVariants({ size: "lg", className: "w-full" })}
          >
            Sign in to accept
          </Link>
        </div>
      ) : wrongAccount ? (
        <div className="flex w-full flex-col gap-2">
          <p className="rounded-md bg-amber-500/10 px-3 py-2 text-2xs/relaxed text-amber-800 dark:text-amber-300">
            You are signed in as {session.user.email}, but this invite is for{" "}
            {data.email}.
          </p>
          <Button
            size="lg"
            className="w-full"
            disabled={signingOut}
            onClick={switchAccount}
          >
            <RiLogoutBoxRLine />
            Sign in as {data.email}
          </Button>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-2">
          <p className="text-2xs/relaxed text-muted-foreground">
            Signed in as {session.user.email}.
          </p>
          <Button
            size="lg"
            className="w-full"
            disabled={accept.isPending}
            onClick={() =>
              accept.mutate(undefined, {
                // A full load so the session, and with it the new role and the
                // admin navigation, is read fresh from the server.
                // A sanchalak starts on their mandal's overview; an admin on the team.
                onSuccess: () =>
                  window.location.assign(
                    data.role === "sanchalak" ? "/" : "/admin"
                  ),
              })
            }
          >
            {accept.isPending && <RiLoader4Line className="animate-spin" />}
            Accept invite
          </Button>
          {accept.isError && (
            <p className="text-2xs/relaxed text-destructive">
              {accept.error.message}
            </p>
          )}
          <Button
            variant="ghost"
            size="lg"
            className="w-full"
            disabled={signingOut || accept.isPending}
            onClick={switchAccount}
          >
            Use a different account
          </Button>
        </div>
      )}
    </Shell>
  )
}
