import { RiTranslate2 } from "@remixicon/react"
import * as React from "react"

import { LanguageContext, useT } from "./context"
import { LANGUAGES, type Lang } from "./translate"

const STORAGE_KEY = "upasana:lang"

function storedLang(): Lang {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value && value in LANGUAGES ? (value as Lang) : "en"
  } catch {
    return "en"
  }
}

/**
 * The language for the public registration pages, remembered on this device,
 * so a devotee who picked Gujarati gets it again on /register/edit or the
 * next visit. Staff screens have no provider and stay in English.
 */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<Lang>(storedLang)
  const setLang = React.useCallback((next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private mode: the choice lasts for this page only.
    }
  }, [])
  const value = React.useMemo(() => ({ lang, setLang }), [lang, setLang])

  return (
    <LanguageContext.Provider value={value}>
      {/* `lang` lets the browser pick a Gujarati font and read it aloud right. */}
      <div lang={lang} className="contents">
        {children}
      </div>
    </LanguageContext.Provider>
  )
}

/**
 * "English / ગુજરાતી", each in its own script, so it can be found by someone
 * who reads only one of them.
 */
export function LanguagePicker() {
  const { lang, setLang } = useT()
  return (
    <label className="relative inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background py-1.5 pr-2.5 pl-2 text-xs/relaxed font-medium focus-within:ring-2 focus-within:ring-ring/30 hover:bg-muted/50 sm:py-1">
      <RiTranslate2
        aria-hidden
        className="size-4 text-muted-foreground sm:size-3.5"
      />
      <span aria-hidden>{LANGUAGES[lang].label}</span>
      {/* The real select is stretched over the label, invisible: a tap opens
          the phone's own picker. */}
      <select
        aria-label="Language / ભાષા"
        value={lang}
        onChange={(event) => setLang(event.target.value as Lang)}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0 [&>option]:bg-popover [&>option]:text-popover-foreground"
      >
        {(Object.keys(LANGUAGES) as Lang[]).map((key) => (
          <option key={key} value={key} lang={key}>
            {LANGUAGES[key].label}
          </option>
        ))}
      </select>
    </label>
  )
}
