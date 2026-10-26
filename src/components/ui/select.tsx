import { RiArrowDownSLine } from "@remixicon/react"
import { cn } from "cn"

/**
 * A native `<select>` dressed to match Input.
 *
 * Native on purpose: most devotees will register from a phone, and the phone's
 * own picker is the one control everyone already knows how to use.
 */
function NativeSelect({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <div className={cn("relative w-full min-w-0", className)}>
      <select
        data-slot="select"
        className={cn(
          "flex h-10 w-full min-w-0 appearance-none rounded-md border border-border bg-transparent py-1 pr-8 pl-3 text-base transition-all outline-none sm:h-8 sm:pr-7 sm:pl-2.5 sm:text-xs/relaxed",
          "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
          "disabled:pointer-events-none disabled:opacity-50",
          "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
          "dark:bg-input/30 [&>option]:bg-popover [&>option]:text-popover-foreground"
        )}
        {...props}
      >
        {children}
      </select>
      <RiArrowDownSLine className="pointer-events-none absolute top-1/2 right-2.5 size-4 sm:right-2 sm:size-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

export { NativeSelect }
