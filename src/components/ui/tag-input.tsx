import { RiCloseLine } from "@remixicon/react"
import { cn } from "cn"
import * as React from "react"

/**
 * A chip editor for a list of short strings.
 *
 * Almost every field in the wizard is a list — job titles, industries,
 * locations, keywords, exclusions — and the review step has to render Claude's
 * generated lists in a form the user can *edit*, not just read. That is this
 * component's real job: a plain textarea would show the plan, but it would not
 * make removing one bad title a single click.
 *
 * Commit keys are Enter and comma. Comma matters because people paste
 * "CTO, VP Engineering, Head of Platform" out of a spreadsheet and expect three
 * chips; pasting is handled explicitly for the same reason.
 */
export function TagInput({
  value,
  onChange,
  placeholder,
  max = 50,
  id,
}: {
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  max?: number
  id?: string
}) {
  const [draft, setDraft] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  const add = (raw: string) => {
    const incoming = raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
    if (incoming.length === 0) return

    // Case-insensitive dedupe, but the first spelling wins — a user who typed
    // "CTO" should not see it silently rewritten to "cto" by a later paste.
    const seen = new Set(value.map((tag) => tag.toLowerCase()))
    const next = [...value]
    for (const tag of incoming) {
      if (next.length >= max) break
      if (seen.has(tag.toLowerCase())) continue
      seen.add(tag.toLowerCase())
      next.push(tag)
    }

    onChange(next)
    setDraft("")
  }

  const removeAt = (index: number) => onChange(value.filter((_, i) => i !== index))

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      // Enter inside a form would submit it, which on the wizard means jumping
      // a step because someone finished typing a job title.
      event.preventDefault()
      add(draft)
      return
    }
    // Backspace on an empty field deletes the last chip — the behaviour every
    // chip input has, and its absence feels broken.
    if (event.key === "Backspace" && draft === "" && value.length > 0) {
      removeAt(value.length - 1)
    }
  }

  return (
    <div
      className={cn(
        "flex min-h-8 w-full flex-wrap items-center gap-1 rounded-md border border-border bg-transparent p-1 transition-all dark:bg-input/30",
        "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30"
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((tag, index) => (
        <span
          key={`${tag}-${index}`}
          className="inline-flex items-center gap-1 rounded-sm bg-secondary py-0.5 pr-0.5 pl-1.5 text-3xs text-secondary-foreground"
        >
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            onClick={(event) => {
              event.stopPropagation()
              removeAt(index)
            }}
            className="rounded-[3px] p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <RiCloseLine className="size-2.5" />
          </button>
        </span>
      ))}

      <input
        ref={inputRef}
        id={id}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        // Commit whatever is half-typed when focus leaves. Losing a title
        // because you clicked Next instead of pressing Enter is infuriating.
        onBlur={() => add(draft)}
        onPaste={(event) => {
          const text = event.clipboardData.getData("text")
          if (!text.includes(",") && !text.includes("\n")) return
          event.preventDefault()
          add(text.replace(/\n/g, ","))
        }}
        placeholder={value.length === 0 ? placeholder : ""}
        disabled={value.length >= max}
        className="h-6 min-w-24 flex-1 bg-transparent px-1 text-xs/relaxed outline-none placeholder:text-muted-foreground disabled:opacity-50"
      />
    </div>
  )
}
