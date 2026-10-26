import {
  RiCalendarLine,
  RiCalendarScheduleLine,
  RiMapPinLine,
  RiUserAddLine,
} from "@remixicon/react"
import { cn } from "cn"
import { NavLink } from "react-router"

// AVIF, then WebP, then JPEG for the rest: each phone downloads the one
// width it needs, about a tenth of the source JPEG on a small screen.
import eventBanner from "@/assets/event-banner.jpg?w=480;672;1008;1344&format=avif;webp;jpg&as=picture"
import { EVENT, formatEventRange } from "@/config/event"
import { useT } from "@/i18n/context"

/**
 * The public pages, as tabs along the bottom of the banner. "Register" stays
 * lit on /register/edit too: changing a registration is part of registering.
 */
const PUBLIC_NAV = [
  { to: "/schedule", label: "Schedule", icon: RiCalendarScheduleLine },
  { to: "/register", label: "Register", icon: RiUserAddLine },
]

/** The banner's width: the column (max-w-2xl less its padding), or the screen less padding. */
const BANNER_SIZES = "(min-width: 672px) 624px, calc(100vw - 2rem)"

/** The event banner on the pages devotees open without signing in. */
export function PublicHeader({
  eyebrow,
  action,
  banner,
  children,
}: {
  /** The small line above the event name, e.g. "Registration open". */
  eyebrow: string
  /** Beside the eyebrow, at the top right: the language picker. */
  action?: React.ReactNode
  /** Show the event poster under the eyebrow. It is 2:1, sized at 2× the column. */
  banner?: boolean
  children?: React.ReactNode
}) {
  const { t, lang } = useT()
  return (
    <header className="border-b border-border bg-primary/5 pt-[env(safe-area-inset-top,0px)]">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 pt-6 pb-3 sm:px-6 sm:pt-8 sm:pb-4">
        <div className="-mt-1 flex min-h-8 items-center justify-between gap-3">
          <span className="text-2xs font-medium tracking-wider text-primary uppercase">
            {eyebrow}
          </span>
          {action}
        </div>
        {banner && (
          <picture>
            {Object.entries(eventBanner.sources).map(([format, srcSet]) => (
              <source
                key={format}
                type={`image/${format === "jpg" ? "jpeg" : format}`}
                srcSet={srcSet}
                sizes={BANNER_SIZES}
              />
            ))}
            <img
              src={eventBanner.img.src}
              width={eventBanner.img.w}
              height={eventBanner.img.h}
              alt={t(
                "Anoopam Youth International Convention 2027, 29 January – 1 February 2027, Ahmedabad"
              )}
              fetchPriority="high"
              className="aspect-2/1 w-full rounded-lg object-cover shadow-sm ring-1 ring-border"
            />
          </picture>
        )}
        {/* The banner carries the event name; the heading stays for screen readers. */}
        <h1
          className={cn(
            "font-heading text-2xl font-semibold text-balance",
            banner && "sr-only"
          )}
        >
          {EVENT.name}
        </h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs/relaxed text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <RiCalendarLine className="size-3.5" />
            {formatEventRange(lang)} · {t("{n} days", { n: EVENT.days.length })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <RiMapPinLine className="size-3.5" />
            {t(EVENT.venue)}
          </span>
        </div>
        {children}
      </div>
      <nav
        aria-label={t("Event pages")}
        className="mx-auto flex w-full max-w-2xl gap-1 px-4 sm:px-6"
      >
        {PUBLIC_NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "-mb-px flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-xs/relaxed text-muted-foreground transition-colors hover:text-foreground",
                isActive && "border-primary font-medium text-foreground"
              )
            }
          >
            <Icon className="size-4 sm:size-3.5" />
            {t(label)}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
