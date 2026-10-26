import { useNavigate, useParams } from "react-router"

import { PageHeader } from "@/components/layout/AppShell"
import { BackLink } from "@/components/layout/BackLink"
import { LoadError } from "@/components/LoadError"
import { EmptyState, Skeleton } from "@/components/ui/primitives"
import { useGuestVisit } from "@/features/guests/api"
import { GuestForm } from "@/features/guests/GuestForm"
import { useSession } from "@/lib/auth-client"

/**
 * `/guests/new` and `/guests/:id/edit`: the team adding a host's guests at
 * the desk, or correcting an entry. Same form as the public link. A sanchalak
 * works within their own mandal.
 */
export function GuestEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: session } = useSession()
  const lockedMandal =
    session?.user.role === "sanchalak"
      ? (session.user.mandal ?? undefined)
      : undefined
  const back = <BackLink to="/guests">Back to guests</BackLink>
  const done = () => navigate("/guests", { replace: true })

  if (!id) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        {back}
        <PageHeader
          title="Add guests"
          description="A host's friends or family coming for the day."
        />
        <GuestForm audience="desk" lockedMandal={lockedMandal} onSaved={done} />
      </div>
    )
  }
  return (
    <EditGuests
      id={id}
      lockedMandal={lockedMandal}
      back={back}
      onSaved={done}
    />
  )
}

function EditGuests({
  id,
  lockedMandal,
  back,
  onSaved,
}: {
  id: string
  lockedMandal?: string
  back: React.ReactNode
  onSaved: () => void
}) {
  const { data: visit, isPending, isError, error, refetch } = useGuestVisit(id)

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
        title="Could not load these guests"
        error={error}
        onRetry={() => void refetch()}
      />
    )
  }
  if (!visit) {
    return (
      <EmptyState
        title="Guest entry not found"
        description="It may have been removed, or it belongs to another mandal."
      />
    )
  }
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      {back}
      <PageHeader title={`Edit ${visit.hostName}'s guests`} />
      <GuestForm
        key={visit.id}
        audience="desk"
        visit={visit}
        lockedMandal={lockedMandal}
        onSaved={onSaved}
      />
    </div>
  )
}
