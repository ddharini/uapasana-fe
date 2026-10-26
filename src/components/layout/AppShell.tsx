import {
  RiCalendarScheduleLine,
  RiDashboardLine,
  RiExternalLinkLine,
  RiFileList3Line,
  RiGroupLine,
  RiHistoryLine,
  RiHotelBedLine,
  RiLogoutBoxRLine,
  RiMenuLine,
  RiPieChart2Line,
  RiSendPlaneLine,
  RiShieldUserLine,
  RiSparkling2Line,
  RiWhatsappLine,
} from "@remixicon/react"
import { useQueryClient } from "@tanstack/react-query"
import { cn } from "cn"
import * as React from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/primitives"
import { EVENT, formatEventRange } from "@/config/event"
import { isAdmin, roleLabel, signOut, useSession } from "@/lib/auth-client"

type NavItem = {
  to: string
  label: string
  short: string
  icon: typeof RiDashboardLine
  /** Also active on the pages under it (a place under Accommodation). */
  nested?: boolean
}

const NAV: NavItem[] = [
  { to: "/", label: "Overview", short: "Home", icon: RiDashboardLine },
  {
    to: "/registrations",
    label: "Registrations",
    short: "Devotees",
    icon: RiFileList3Line,
    // Also lit on a registration and on the new-registration form, which is
    // reached from this screen's "New registration" button.
    nested: true,
  },
  {
    to: "/accommodation",
    label: "Accommodation",
    short: "Stay",
    icon: RiHotelBedLine,
    nested: true,
  },
]

/**
 * Desk screens past the three everyday ones: tabs from `sm` up, behind "More"
 * on a phone.
 */
const EXTRA_NAV: NavItem[] = [
  {
    to: "/guests",
    label: "Guests",
    short: "Guests",
    icon: RiGroupLine,
    nested: true,
  },
]

const ADMIN_NAV: NavItem[] = [
  {
    to: "/admin/assistant",
    label: "Assistant",
    short: "Assistant",
    icon: RiSparkling2Line,
  },
  {
    to: "/admin/reports",
    label: "Reports",
    short: "Reports",
    icon: RiPieChart2Line,
  },
  {
    to: "/admin/schedule",
    label: "Schedule",
    short: "Schedule",
    icon: RiCalendarScheduleLine,
  },
  { to: "/admin/logs", label: "Logs", short: "Logs", icon: RiHistoryLine },
  {
    to: "/admin/messages",
    label: "Send messages",
    short: "Send",
    icon: RiSendPlaneLine,
    // Also lit while writing a new message and on a past send.
    nested: true,
  },
  {
    to: "/admin/whatsapp",
    label: "WhatsApp",
    short: "WhatsApp",
    icon: RiWhatsappLine,
  },
  { to: "/admin", label: "Team", short: "Team", icon: RiShieldUserLine },
]

function SignOutButton() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [signingOut, setSigningOut] = React.useState(false)

  /**
   * The cache is cleared *after* the redirect, and it is not optional: React
   * Query keys data by id alone, with nothing about who it belongs to, so a
   * second sign-in on the same tab would otherwise paint the previous account's
   * data for as long as the refetch takes.
   */
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
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Sign out"
      disabled={signingOut}
      onClick={handleSignOut}
    >
      <RiLogoutBoxRLine />
    </Button>
  )
}

/** Who is signed in, from `md` up. Phones are short on header room. */
function SignedInAs() {
  const { data: session } = useSession()
  if (!session) return null
  return (
    <span className="hidden max-w-48 items-center gap-1.5 text-2xs text-muted-foreground md:flex">
      <span className="truncate">{session.user.name}</span>
      {(session.user.role === "admin" || session.user.role === "sanchalak") && (
        <Badge variant="outline">
          {roleLabel(session.user.role, session.user.mandal)}
        </Badge>
      )}
    </span>
  )
}

const tabClass = (active: boolean) =>
  cn(
    "flex h-14 min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 text-3xs text-muted-foreground transition-colors",
    active && "font-medium text-primary"
  )

/**
 * The phone tab bar. Five slots at most: at 375px and in this monospace font,
 * a sixth label no longer fits. The four everyday screens are always tabs;
 * anything beyond (Guests, the admin screens) goes behind "More", a sheet
 * that opens above the bar.
 */
function PhoneNav({ main, more }: { main: NavItem[]; more: NavItem[] }) {
  const { pathname } = useLocation()
  // Open only on the page it was opened on, so following a link in it, or
  // any other navigation, closes it without an effect.
  const [openOn, setOpenOn] = React.useState<string | null>(null)
  const open = openOn === pathname
  const setOpen = (next: boolean) => setOpenOn(next ? pathname : null)
  const inMore = more.some(
    ({ to }) => pathname === to || pathname.startsWith(`${to}/`)
  )

  // Escape closes it too.
  React.useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) =>
      event.key === "Escape" && setOpenOn(null)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 sm:hidden print:hidden">
          <div
            aria-hidden
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-background/60 backdrop-blur-[2px]"
          />
          <div
            id="more-menu"
            className="absolute inset-x-0 bottom-(--bottom-nav-h) rounded-t-xl border-t border-border bg-background p-2 shadow-lg"
          >
            <ul className="flex flex-col">
              {more.map(({ to, label, icon: Icon, nested }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={!nested}
                    className={({ isActive }) =>
                      cn(
                        "flex h-12 items-center gap-3 rounded-md px-3 text-xs text-foreground hover:bg-muted",
                        isActive && "bg-primary/10 font-medium text-primary"
                      )
                    }
                  >
                    <Icon className="size-5" />
                    {label}
                  </NavLink>
                </li>
              ))}
              <li className="mt-1 border-t border-border pt-1">
                <a
                  href="/schedule"
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-12 items-center gap-3 rounded-md px-3 text-xs text-muted-foreground hover:bg-muted"
                >
                  <RiExternalLinkLine className="size-5" />
                  Public schedule
                </a>
              </li>
              <li>
                <a
                  href="/guests/register"
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-12 items-center gap-3 rounded-md px-3 text-xs text-muted-foreground hover:bg-muted"
                >
                  <RiExternalLinkLine className="size-5" />
                  Guest form
                </a>
              </li>
            </ul>
          </div>
        </div>
      )}

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 grid auto-cols-[minmax(0,1fr)] grid-flow-col border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur sm:hidden print:hidden"
      >
        {main.map(({ to, short, icon: Icon, nested }) => (
          <NavLink
            key={to}
            to={to}
            end={!nested}
            className={({ isActive }) => tabClass(isActive && !open)}
          >
            <Icon className="size-5 shrink-0" />
            <span className="max-w-full truncate">{short}</span>
          </NavLink>
        ))}
        {more.length > 0 && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls="more-menu"
            onClick={() => setOpen(!open)}
            className={tabClass(open || inMore)}
          >
            <RiMenuLine className="size-5 shrink-0" />
            <span className="max-w-full truncate">More</span>
          </button>
        )}
      </nav>
    </>
  )
}

/**
 * The staff side: event name on top, navigation, and the current screen below.
 *
 * On a phone the navigation is a tab bar along the bottom, within thumb reach;
 * from `sm` up it moves into the header as tabs. `--bottom-nav-h` carries the
 * tab bar's height so anything pinned to the bottom (the form's Continue bar)
 * can sit just above it.
 */
export function AppShell() {
  const { data: session } = useSession()
  const more = isAdmin(session?.user.role)
    ? [...EXTRA_NAV, ...ADMIN_NAV]
    : EXTRA_NAV
  const nav = [...NAV, ...more]

  // The header's height as --app-header-h, for anything that sticks just
  // below it (BackLink). Measured, since it is taller from `sm` up where the
  // tabs move into it, and taller again under a notch.
  const shellRef = React.useRef<HTMLDivElement>(null)
  const headerRef = React.useRef<HTMLElement>(null)
  React.useEffect(() => {
    const header = headerRef.current
    if (!header) return
    const observer = new ResizeObserver(() =>
      shellRef.current?.style.setProperty(
        "--app-header-h",
        `${header.getBoundingClientRect().height}px`
      )
    )
    observer.observe(header)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={shellRef}
      className="flex min-h-svh flex-col [--bottom-nav-h:calc(3.5rem+env(safe-area-inset-bottom,0px))] [--bottom-safe:0px] sm:[--bottom-nav-h:0px]"
    >
      <header
        ref={headerRef}
        className="sticky top-0 z-30 border-b border-border bg-background/90 pt-[env(safe-area-inset-top,0px)] backdrop-blur print:hidden"
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden
              className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary font-heading text-sm font-semibold text-primary-foreground"
            >
              ॐ
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-heading text-sm font-medium">
                {EVENT.name}
              </span>
              <span className="truncate text-2xs text-muted-foreground">
                {formatEventRange()} · {EVENT.venue}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <SignedInAs />
            <a
              href="/register"
              target="_blank"
              rel="noreferrer"
              aria-label="Open the public registration form"
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-2xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:h-auto sm:py-1"
            >
              <span className="hidden sm:inline">Public form</span>
              <RiExternalLinkLine className="size-4 sm:size-3" />
            </a>
            <SignOutButton />
          </div>
        </div>

        <nav className="mx-auto hidden w-full max-w-6xl gap-1 px-6 sm:flex">
          {nav.map(({ to, label, icon: Icon, nested }) => (
            <NavLink
              key={to}
              to={to}
              end={!nested}
              className={({ isActive }) =>
                cn(
                  "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-2.5 py-2 text-xs/relaxed text-muted-foreground transition-colors hover:text-foreground",
                  isActive && "border-primary font-medium text-foreground"
                )
              }
            >
              <Icon className="size-3.5" />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 pt-5 pb-[calc(var(--bottom-nav-h)+1.5rem)] sm:gap-6 sm:px-6 sm:pt-6">
        {/* Screens load on first visit (App.tsx); the header and tabs stay up meanwhile. */}
        <React.Suspense fallback={null}>
          <Outlet />
        </React.Suspense>
      </main>

      <PhoneNav main={NAV} more={more} />
    </div>
  )
}

/** Title row shared by every staff screen. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="font-heading text-lg font-medium text-balance">
          {title}
        </h1>
        {description && (
          <p className="text-xs/relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {/* Phones: the buttons share the full width, rows of equal-width
          buttons rather than a ragged wrap. */}
      {actions && (
        <div className="flex w-full flex-wrap items-center gap-2 *:grow sm:w-auto sm:*:grow-0">
          {actions}
        </div>
      )}
    </div>
  )
}
