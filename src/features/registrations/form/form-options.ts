import * as React from "react"

/**
 * How the registration form is being used, for the steps that behave
 * differently. Set once by RegistrationForm.
 */
export type FormOptions = {
  /**
   * "new": a fresh registration (public page or desk).
   * "edit-desk": a team member changing a saved one.
   * "edit-self": the devotee changing their own, after an OTP — the contact's
   * number is then fixed.
   */
  mode: "new" | "edit-desk" | "edit-self"
  /** Whether the user may tick "Verified in person" instead of sending a code. */
  allowInPerson: boolean
  /** A sanchalak's mandal: the only one they register people for. */
  lockedMandal?: string
  /** The registration being edited, left out of "already registered" warnings. */
  editingId?: string
  /** Whether the user is on the desk (signed in) rather than the public page. */
  atDesk: boolean
}

export const FormOptionsContext = React.createContext<FormOptions>({
  mode: "new",
  allowInPerson: false,
  atDesk: false,
})

export const useFormOptions = () => React.useContext(FormOptionsContext)
