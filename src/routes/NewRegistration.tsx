import * as React from "react"
import { Link, useSearchParams } from "react-router"

import { PageHeader } from "@/components/layout/AppShell"
import { Button, buttonVariants } from "@/components/ui/button"
import { RegistrationConfirmation } from "@/features/registrations/components"
import { RegistrationForm } from "@/features/registrations/form/RegistrationForm"
import type { Registration } from "@/features/registrations/types"
import { canVouchInPerson, useSession } from "@/lib/auth-client"

/**
 * The team registering someone at the desk or over the phone. Same form as the
 * public page; a sanchalak registers for their own mandal only, and they and
 * admins may vouch for a number in person instead of an OTP.
 */
export function NewRegistration() {
  const { data: session } = useSession()
  const [, setParams] = useSearchParams()
  const [saved, setSaved] = React.useState<Registration>()
  // Remounting the form is the simplest way to clear every field and step.
  const [formKey, setFormKey] = React.useState(0)

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader
        title="New registration"
        description={
          session?.user.role === "sanchalak"
            ? `For devotees of ${session.user.mandal ?? "your mandal"}, at the desk or over the phone.`
            : "For devotees registering at the desk or over the phone."
        }
      />
      {saved ? (
        <RegistrationConfirmation
          registration={saved}
          actions={
            <>
              <Link to={`/registrations/${saved.id}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
                Open registration
              </Link>
              <Button
                size="lg"
                onClick={() => {
                  setSaved(undefined)
                  setFormKey((k) => k + 1)
                  // The next registration starts at step 1.
                  setParams({}, { replace: true })
                }}
              >
                Register someone else
              </Button>
            </>
          }
        />
      ) : (
        <RegistrationForm
          key={formKey}
          source="staff"
          onRegistered={setSaved}
          allowInPerson={canVouchInPerson(session?.user.role)}
          lockedMandal={session?.user.role === "sanchalak" ? (session.user.mandal ?? undefined) : undefined}
        />
      )}
    </div>
  )
}
