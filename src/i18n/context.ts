import * as React from "react"

import { localeOf, translator, type Lang } from "./translate"

export const LanguageContext = React.createContext<{
  lang: Lang
  setLang: (lang: Lang) => void
}>({
  // Outside a LanguageProvider — every staff screen — it is English.
  lang: "en",
  setLang: () => {},
})

/** The current language, and `t` to translate into it. English outside a LanguageProvider. */
export function useT() {
  const { lang, setLang } = React.useContext(LanguageContext)
  return { t: translator(lang), lang, setLang, locale: localeOf(lang) }
}
