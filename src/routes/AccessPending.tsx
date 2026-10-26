import { RiLockLine, RiLogoutBoxRLine } from "@remixicon/react"
import { useQueryClient } from "@tanstack/react-query"
import * as React from "react"
import { useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/primitives"
import { signOut, useSession } from "@/lib/auth-client"

/**
 * Shown to a signed-in account that has not been given access to the
 * registration desk. Registrations hold devotees' personal details, so a new
 * account sees nothing until an organiser grants it the staff role.
 */
export function AccessPending() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const [signingOut, setSigningOut] = React.useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    const result = await signOut()
    if (result.error) {
      setSigningOut(false)
      return
    }
    navigate("/login", { replace: true })
    queryClient.clear()
  }

  return (
    <div className="flex min-h-svh items-center justify-center px-4 py-8">
      <Card className="w-full max-w-sm items-center gap-4 py-8 text-center">
        <RiLockLine className="size-8 text-muted-foreground" />
        <div className="flex flex-col gap-1.5">
          <h1 className="font-heading text-base font-medium">
            Waiting for access
          </h1>
          <p className="text-xs/relaxed text-muted-foreground">
            You are signed in as {session?.user.email}. Ask an organiser to give
            this account staff access, then reload this page.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2">
          <Button size="lg" onClick={() => window.location.reload()}>
            Reload
          </Button>
          <Button
            size="lg"
            variant="ghost"
            disabled={signingOut}
            onClick={handleSignOut}
          >
            <RiLogoutBoxRLine />
            Sign out
          </Button>
        </div>
      </Card>
    </div>
  )
}
