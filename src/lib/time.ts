/** "06:30" → "6:30 am", "18:05" → "6:05 pm". Anything else comes back as it is. */
export function formatTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return value
  const hours = Number(match[1])
  return `${hours % 12 || 12}:${match[2]} ${hours >= 12 ? "pm" : "am"}`
}
