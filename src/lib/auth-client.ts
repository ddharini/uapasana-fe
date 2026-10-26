import { inferAdditionalFields } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

/**
 * Better Auth's React client, pointed at the backend's own origin.
 *
 * `baseURL` is the server root, not the `/api/auth` path — the client appends
 * that itself. It is derived from the same variable as the API client so a
 * deployment configures one URL, not two that can disagree.
 *
 * `role` is one of the backend's extra user fields (upasana-be src/lib/auth.ts).
 * Declaring it here types it on `session.user`, which is where the app decides
 * whether this account may see registrations.
 */
const apiUrl = import.meta.env.VITE_API_URL ?? "/api"

// Better Auth wants an absolute URL. A relative `/api` (the dev proxy) is this
// page's own origin.
const apiOrigin = new URL(apiUrl, window.location.origin)
  .toString()
  .replace(/\/api\/?$/, "")

export const authClient = createAuthClient({
  baseURL: apiOrigin,
  plugins: [
    inferAdditionalFields({
      user: {
        role: { type: "string", required: false, input: false },
        // A sanchalak's mandal: the desk shows and registers only that one.
        mandal: { type: "string", required: false, input: false },
      },
    }),
  ],
})

export const { signIn, signUp, signOut, useSession } = authClient

/**
 * Roles that may use the staff screens. Matches `requireStaff` on the backend.
 * A sanchalak sees only their own mandal there; the server enforces it.
 */
export function isStaff(role: string | null | undefined) {
  return role === "staff" || role === "admin" || role === "sanchalak"
}

/** May check in, cancel and restore. Matches `requireReviewer` on the backend. */
export function canReview(role: string | null | undefined) {
  return role === "staff" || role === "admin"
}

/** May vouch for a contact's number in person instead of an OTP. */
export function canVouchInPerson(role: string | null | undefined) {
  return role === "sanchalak" || role === "admin"
}

/** "Admin", "Sanchalak · Surat", … for showing who someone is. */
export function roleLabel(role: string | null | undefined, mandal?: string | null) {
  if (role === "sanchalak") return mandal ? `Sanchalak · ${mandal}` : "Sanchalak"
  if (role === "admin") return "Admin"
  if (role === "staff") return "Staff"
  return "No access"
}

/** May manage the admin team. Matches `requireAdmin` on the backend. */
export function isAdmin(role: string | null | undefined) {
  return role === "admin"
}
