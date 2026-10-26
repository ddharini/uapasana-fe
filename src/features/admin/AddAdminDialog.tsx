import {
  RiCheckLine,
  RiFileCopyLine,
  RiLoader4Line,
  RiMailLine,
  RiMessage2Line,
  RiShieldUserLine,
  RiSmartphoneLine,
  RiTeamLine,
  RiWhatsappLine,
} from "@remixicon/react"
import * as React from "react"

import { Button, buttonVariants } from "@/components/ui/button"
import { ChoiceGroup } from "@/components/ui/choice"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog"
import { Field, Input } from "@/components/ui/input"
import { PhoneInput } from "@/components/ui/phone-input"
import { MandalSelect } from "@/components/MandalSelect"
import { EVENT } from "@/config/event"
import { useSession } from "@/lib/auth-client"
import {
  DEFAULT_COUNTRY_CODE,
  formatMobile,
  mobileError,
  toE164,
} from "@/lib/phone"

import {
  useCreateInvite,
  type CreatedInvite,
  type Delivery,
  type TeamRole,
} from "./api"

const ROLE_OPTIONS = [
  {
    value: "admin" as const,
    label: "Admin",
    description: "Everything, including inviting others.",
    icon: <RiShieldUserLine />,
  },
  {
    value: "sanchalak" as const,
    label: "Mandal sanchalak",
    description: "Registers and edits their own mandal's devotees.",
    icon: <RiTeamLine />,
  },
]

type Channel = "email" | "mobile"

/** Says who sends the link, which depends on what the server has set up. */
function channelOptions(delivery: Delivery) {
  return [
    {
      value: "email" as const,
      label: "Email",
      description: delivery.email
        ? "We email them the link."
        : "You send them the link.",
      icon: <RiMailLine />,
    },
    {
      value: "mobile" as const,
      label: "Mobile",
      description: delivery.whatsapp
        ? "We send them the link on WhatsApp."
        : "You send the link on WhatsApp or SMS.",
      icon: <RiSmartphoneLine />,
    },
  ]
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Invite someone to the team — an admin, or a sanchalak for one mandal — in
 * two steps: who, then how the link reached
 * them.
 *
 * The server sends the invite by email (Resend) or on WhatsApp (Meta Cloud API) when
 * that channel is set up. The second step always shows the link as well, with
 * WhatsApp and SMS buttons that open on the admin's own phone, so an invite
 * the server could not deliver still gets there.
 */
export function AddAdminDialog({
  open,
  onOpenChange,
  delivery,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  delivery: Delivery
}) {
  const [created, setCreated] = React.useState<CreatedInvite>()

  // Start clean every time it opens: a link from the last invite left on
  // screen is a link sent to the wrong person.
  const close = (next: boolean) => {
    onOpenChange(next)
    if (!next) setCreated(undefined)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        {created ? (
          <ShareStep created={created} onDone={() => close(false)} />
        ) : (
          <InviteStep
            delivery={delivery}
            onCreated={setCreated}
            onCancel={() => close(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function InviteStep({
  delivery,
  onCreated,
  onCancel,
}: {
  delivery: Delivery
  onCreated: (created: CreatedInvite) => void
  onCancel: () => void
}) {
  const createInvite = useCreateInvite()
  const [channel, setChannel] = React.useState<Channel>("email")
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [country, setCountry] = React.useState<string>(DEFAULT_COUNTRY_CODE)
  const [mobile, setMobile] = React.useState("")
  const [role, setRole] = React.useState<TeamRole>("admin")
  const [mandal, setMandal] = React.useState("")
  const [error, setError] = React.useState<string>()
  const [mandalError, setMandalError] = React.useState<string>()

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setError(undefined)
    setMandalError(undefined)

    if (role === "sanchalak" && !mandal) {
      setMandalError("Select the mandal they will coordinate")
      return
    }
    const who = {
      name: name.trim() || undefined,
      role,
      mandal: role === "sanchalak" ? mandal : undefined,
    }

    if (channel === "email") {
      const value = email.trim().toLowerCase()
      if (!EMAIL.test(value)) return setError("Enter a valid email address")
      createInvite.mutate(
        { channel, email: value, ...who },
        { onSuccess: onCreated }
      )
    } else {
      const problem = mobile
        ? mobileError(mobile, country)
        : "Enter the mobile number"
      if (problem) return setError(problem)
      createInvite.mutate(
        { channel, mobile: toE164(country, mobile), ...who },
        { onSuccess: onCreated }
      )
    }
  }

  const serverError = createInvite.error?.message
  const serverSends = channel === "email" ? delivery.email : delivery.whatsapp

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
      <DialogHeader
        title="Invite to the team"
        description="They get a link to sign in and accept."
      />
      <DialogBody>
        <Field label="Role" required>
          <ChoiceGroup
            name="role"
            value={role}
            onChange={(next) => {
              setRole(next)
              createInvite.reset()
            }}
            options={ROLE_OPTIONS}
            className="grid-cols-1 sm:grid-cols-2"
          />
        </Field>

        {role === "sanchalak" && (
          <Field
            label="Mandal"
            required
            hint="They see and register only this mandal's devotees."
            error={mandalError}
          >
            <MandalSelect
              id="invite-mandal"
              value={mandal}
              onChange={(value) => {
                setMandal(value)
                setMandalError(undefined)
              }}
              placeholder="Select mandal"
              invalid={!!mandalError}
            />
          </Field>
        )}

        <ChoiceGroup
          name="channel"
          value={channel}
          onChange={(next) => {
            setChannel(next)
            setError(undefined)
            createInvite.reset()
          }}
          options={channelOptions(delivery)}
          className="grid-cols-2"
        />

        <Field label="Name (optional)">
          <Input
            id="invite-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="So you recognise them in the list"
            autoComplete="off"
          />
        </Field>

        {channel === "email" ? (
          <Field label="Email" error={error}>
            <Input
              id="invite-email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              autoComplete="off"
              aria-invalid={!!error}
              autoFocus
            />
          </Field>
        ) : (
          <Field
            label={delivery.whatsapp ? "WhatsApp number" : "Mobile"}
            hint="They sign in with Google or an email and password after opening the link."
            error={error}
          >
            <PhoneInput
              id="invite-mobile"
              countryCode={country}
              placeholder="9876543210"
              invalid={!!error}
              codeProps={{
                value: country,
                onChange: (e) => setCountry(e.target.value),
              }}
              numberProps={{
                value: mobile,
                onChange: (e) => setMobile(e.target.value),
                autoFocus: true,
              }}
            />
          </Field>
        )}

        {serverError && (
          <p className="text-2xs/relaxed text-destructive">{serverError}</p>
        )}
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="ghost" size="lg" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={createInvite.isPending}>
          {createInvite.isPending && <RiLoader4Line className="animate-spin" />}
          {serverSends ? "Send invite" : "Create invite link"}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** The header and note for each outcome of a send. */
function outcome({ invite, sent, notSentReason }: CreatedInvite, to: string) {
  const via = invite.channel === "email" ? "email" : "WhatsApp"
  if (sent) {
    return {
      title: invite.channel === "email" ? "Invite emailed" : "Sent on WhatsApp",
      description: `We sent the link to ${to} by ${via}.`,
      note: undefined,
    }
  }
  if (notSentReason === "failed") {
    return {
      title: "Send the invite link",
      description: `The ${via} message to ${to} could not be sent. Send them the link yourself.`,
      note: `The invite is created and waiting. Check the number${invite.channel === "email" ? " or address" : ""} is right; the server log has the provider's reason.`,
    }
  }
  return {
    title: "Send the invite link",
    description: `Send this link to ${to}.`,
    // Only worth saying for email: a person picking Mobile was already told
    // they would send it themselves.
    note:
      invite.channel === "email"
        ? "Email sending is not set up on the server yet. The invite is created and waiting; it only needs to reach them."
        : undefined,
  }
}

function ShareStep({
  created,
  onDone,
}: {
  created: CreatedInvite
  onDone: () => void
}) {
  const { data: session } = useSession()
  const [copied, setCopied] = React.useState(false)
  const { invite, url, sent } = created

  const inviter = session?.user.name ?? "An admin"
  const role =
    invite.role === "sanchalak"
      ? `Mandal sanchalak for ${invite.mandal}`
      : "an admin"
  const message = `${inviter} has invited you to join ${EVENT.name} as ${role}. Open this link to accept — it works once and expires in 7 days:\n${url}`
  const to = (invite.mobile ? formatMobile(invite.mobile) : invite.email) ?? ""
  const waNumber = invite.mobile?.replace(/^\+/, "")
  const { title, description, note } = outcome(created, to)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be blocked (non-HTTPS on a phone over Wi-Fi). The link
      // is on screen and selectable, which is the fallback.
    }
  }

  return (
    <div className="flex min-h-0 flex-col">
      <DialogHeader title={title} description={description} />
      <DialogBody>
        {note && (
          <p className="rounded-md bg-amber-500/10 px-3 py-2 text-2xs/relaxed text-amber-800 dark:text-amber-300">
            {note}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-xs/relaxed font-medium">Invite link</span>
          <div className="flex items-stretch gap-2">
            <Input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Invite link"
              className="font-mono text-2xs sm:text-3xs"
            />
            <Button
              variant="outline"
              size="lg"
              onClick={copy}
              aria-label="Copy link"
            >
              {copied ? <RiCheckLine /> : <RiFileCopyLine />}
              <span className="hidden sm:inline">
                {copied ? "Copied" : "Copy"}
              </span>
            </Button>
          </div>
          <p className="text-2xs/relaxed text-muted-foreground">
            Works once and expires in 7 days.
            {invite.channel === "email" &&
              ` Only an account signed in as ${invite.email} can accept it.`}
          </p>
        </div>

        {/* Once the server has delivered it, sending again from here is a duplicate. */}
        {!sent && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <a
              href={`https://wa.me/${waNumber ?? ""}?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              <RiWhatsappLine />
              Send on WhatsApp
            </a>
            {invite.mobile && (
              // `?&body=` rather than `?body=`: iOS reads the first, Android
              // the second, and both tolerate the stray `&`.
              <a
                href={`sms:${invite.mobile}?&body=${encodeURIComponent(message)}`}
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                <RiMessage2Line />
                Send SMS
              </a>
            )}
          </div>
        )}
      </DialogBody>
      <DialogFooter>
        <Button size="lg" onClick={onDone}>
          Done
        </Button>
      </DialogFooter>
    </div>
  )
}
