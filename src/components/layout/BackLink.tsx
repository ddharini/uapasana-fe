import { RiArrowLeftLine } from "@remixicon/react"
import { cn } from "cn"
import * as React from "react"
import { Link } from "react-router"

/**
 * The "← Back to …" link at the top of a staff screen. Sticks right at the
 * bottom edge of the app header (--app-header-h, set by AppShell) so it is
 * still there after scrolling down a long page.
 *
 * Once stuck it hangs from the header like a tab: a frosted background just
 * the width of the link, rounded at the bottom, so whatever scrolls under it
 * is blurred around the text. At the top of the page it is a plain link.
 */
export function BackLink({
  to,
  children,
  className,
}: {
  to: string
  children: React.ReactNode
  className?: string
}) {
  const ref = React.useRef<HTMLAnchorElement>(null)
  const [stuck, setStuck] = React.useState(false)

  React.useEffect(() => {
    const link = ref.current
    if (!link) return
    let frame = 0
    // Stuck when it sits at its sticky offset and the page has scrolled.
    const check = () => {
      frame = 0
      const offset = parseFloat(getComputedStyle(link).top) || 0
      setStuck(
        window.scrollY > 0 && link.getBoundingClientRect().top <= offset + 1
      )
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check)
    }
    check()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [])

  return (
    // The negative margins cancel the padding, so at rest it takes the same
    // room as a bare link and sits where it always did.
    <Link
      ref={ref}
      to={to}
      className={cn(
        "sticky top-[var(--app-header-h,3.5rem)] z-20 -mx-2 -my-1.5 inline-flex items-center gap-1 self-start rounded-b-md border border-t-0 px-2 py-1.5 text-2xs text-muted-foreground transition-[background-color,border-color,box-shadow,color] duration-200 hover:text-foreground",
        stuck
          ? "border-border bg-background/60 shadow-sm backdrop-blur-md"
          : "border-transparent",
        className
      )}
    >
      <RiArrowLeftLine className="size-3" />
      {children}
    </Link>
  )
}
