import { RiMailLine, RiSmartphoneLine, RiUserAddLine } from "@remixicon/react"
import * as React from "react"

import { PageHeader } from "@/components/layout/AppShell"
import { LoadError } from "@/components/LoadError"
import { Button } from "@/components/ui/button"
import { Badge, Card, CardTitle, Skeleton } from "@/components/ui/primitives"
import { AddAdminDialog } from "@/features/admin/AddAdminDialog"
import {
  useAdminTeam,
  useRevokeInvite,
  type Admin,
  type Invite,
} from "@/features/admin/api"
import { roleLabel, useSession } from "@/lib/auth-client"
import { formatMobile } from "@/lib/phone"

const DATE = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
})
const formatDate = (iso: string) => DATE.format(new Date(iso))

function Initial({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 font-heading text-sm font-medium text-primary sm:size-8 sm:text-xs"
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  )
}

function AdminRow({ admin, isYou }: { admin: Admin; isYou: boolean }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Initial name={admin.name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-1.5 text-xs/relaxed font-medium">
          <span className="truncate">{admin.name}</span>
          {isYou && <Badge variant="outline">You</Badge>}
          {admin.role === "sanchalak" && admin.mandal && (
            <Badge>{admin.mandal}</Badge>
          )}
        </span>
        <span className="truncate text-2xs text-muted-foreground">
          {admin.email}
        </span>
      </div>
      <span className="hidden shrink-0 text-2xs text-muted-foreground sm:inline">
        Joined {formatDate(admin.createdAt)}
      </span>
    </li>
  )
}

function InviteRow({ invite }: { invite: Invite }) {
  const revoke = useRevokeInvite()
  const target = invite.mobile
    ? formatMobile(invite.mobile)
    : (invite.email ?? "")
  const expired = invite.status === "expired"
  const Icon = invite.channel === "mobile" ? RiSmartphoneLine : RiMailLine

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground sm:size-8"
      >
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-1.5 text-xs/relaxed font-medium">
          <span className="truncate">{invite.name || target}</span>
          <Badge variant="outline">
            {roleLabel(invite.role, invite.mandal)}
          </Badge>
          {expired ? (
            <Badge variant="destructive">Expired</Badge>
          ) : (
            <Badge variant="warning">Pending</Badge>
          )}
        </span>
        <span className="truncate text-2xs text-muted-foreground tabular-nums">
          {invite.name && `${target} · `}
          Invited by {invite.invitedByName} ·{" "}
          {expired
            ? `expired ${formatDate(invite.expiresAt)}`
            : `expires ${formatDate(invite.expiresAt)}`}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        disabled={revoke.isPending}
        onClick={() => revoke.mutate(invite.id)}
      >
        {expired ? "Remove" : "Revoke"}
      </Button>
    </li>
  )
}

/** Admin only: who the admins are, who has been invited, and inviting more. */
export function AdminTeam() {
  const { data: session } = useSession()
  const { data, isPending, isError, error, refetch } = useAdminTeam()
  const [adding, setAdding] = React.useState(false)

  const header = (
    <PageHeader
      title="Team"
      description="Admins run everything and invite others. Mandal sanchalaks register and edit their own mandal's devotees."
      actions={
        <Button size="lg" onClick={() => setAdding(true)}>
          <RiUserAddLine />
          Invite someone
        </Button>
      }
    />
  )

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 sm:gap-6">
      {header}

      {isPending ? (
        <Skeleton className="h-64" />
      ) : isError ? (
        <LoadError
          title="Could not load the team"
          error={error}
          onRetry={() => void refetch()}
        />
      ) : (
        <>
          {(
            [
              ["Admins", data.admins.filter((m) => m.role === "admin")],
              [
                "Mandal sanchalaks",
                data.admins
                  .filter((m) => m.role === "sanchalak")
                  .sort((a, b) =>
                    (a.mandal ?? "").localeCompare(b.mandal ?? "")
                  ),
              ],
            ] as const
          ).map(([title, people]) =>
            people.length === 0 ? null : (
              <Card key={title} className="gap-0 p-0">
                <div className="flex items-baseline justify-between gap-2 border-b border-border px-4 py-3">
                  <CardTitle>{title}</CardTitle>
                  <span className="text-2xs text-muted-foreground tabular-nums">
                    {people.length}
                  </span>
                </div>
                <ul className="divide-y divide-border">
                  {people.map((person) => (
                    <AdminRow
                      key={person.id}
                      admin={person}
                      isYou={person.id === session?.user.id}
                    />
                  ))}
                </ul>
              </Card>
            )
          )}

          {data.invites.length > 0 && (
            <Card className="gap-0 p-0">
              <div className="flex items-baseline justify-between gap-2 border-b border-border px-4 py-3">
                <CardTitle>Invites</CardTitle>
                <span className="text-2xs text-muted-foreground">
                  Waiting to be accepted
                </span>
              </div>
              <ul className="divide-y divide-border">
                {data.invites.map((invite) => (
                  <InviteRow key={invite.id} invite={invite} />
                ))}
              </ul>
            </Card>
          )}

          <p className="text-2xs/relaxed text-muted-foreground">
            Lost an invite link? Add the same email or mobile again — that sends
            a fresh link and the old one stops working.
          </p>
        </>
      )}

      <AddAdminDialog
        open={adding}
        onOpenChange={setAdding}
        // Until the team has loaded, assume nothing is set up: the dialog then
        // offers the share buttons, which always work.
        delivery={data?.delivery ?? { email: false, whatsapp: false }}
      />
    </div>
  )
}
