import { useNavigate, useParams } from "react-router"

import { PageHeader } from "@/components/layout/AppShell"
import { BackLink } from "@/components/layout/BackLink"
import { LoadError } from "@/components/LoadError"
import { EmptyState, Skeleton } from "@/components/ui/primitives"
import { useRegistration } from "@/features/registrations/api"
import { displayName } from "@/features/registrations/format"
import { RegistrationForm } from "@/features/registrations/form/RegistrationForm"
import { canVouchInPerson, useSession } from "@/lib/auth-client"

/**
 * `/registrations/:id/edit`: a team member changing a saved registration —
 * same form, filled in. The status stays as it is; changing the contact's
 * number needs it verified again (or vouched for in person by a sanchalak or
 * admin). A sanchalak only reaches their own mandal's registrations.
 */
export function EditRegistration() {
  const { id = "" } = useParams()
  const navigate = useNavigate()
  const { data: session } = useSession()
  const {
    data: registration,
    isPending,
    isError,
    error,
    refetch,
  } = useRegistration(id)

  const back = (
    <BackLink to={`/registrations/${id}`}>Back to the registration</BackLink>
  )

  if (isPending) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        {back}
        <Skeleton className="h-96" />
      </div>
    )
  }
  if (isError) {
    return (
      <LoadError
        title="Could not load this registration"
        error={error}
        onRetry={() => void refetch()}
      />
    )
  }
  if (!registration) {
    return (
      <EmptyState
        title="Registration not found"
        description="It may have been removed, or it belongs to another mandal."
      />
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      {back}
      <PageHeader
        title={`Edit ${displayName(registration)}`}
        description={`${registration.code} · the status stays as it is.`}
      />
      <RegistrationForm
        key={registration.id}
        source="staff"
        editing={{ registration, as: "desk" }}
        allowInPerson={canVouchInPerson(session?.user.role)}
        lockedMandal={
          session?.user.role === "sanchalak"
            ? (session.user.mandal ?? undefined)
            : undefined
        }
        onRegistered={(updated) =>
          navigate(`/registrations/${updated.id}`, { replace: true })
        }
      />
    </div>
  )
}
