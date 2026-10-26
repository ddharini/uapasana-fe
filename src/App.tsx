import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import * as React from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router"

import { AppShell } from "@/components/layout/AppShell"
import { isAdmin, isStaff, useSession } from "@/lib/auth-client"
import { AccessPending } from "@/routes/AccessPending"

/**
 * Each screen is its own chunk, fetched the first time it is opened: a
 * devotee on the public form downloads the form, not the whole desk. Routes
 * export named components, hence the `.then`.
 */
const page = <K extends string>(
  load: () => Promise<Record<K, React.ComponentType>>,
  name: K
) => React.lazy(() => load().then((module) => ({ default: module[name] })))

const AcceptInvite = page(() => import("@/routes/AcceptInvite"), "AcceptInvite")
const Accommodation = page(
  () => import("@/routes/Accommodation"),
  "Accommodation"
)
const AccommodationPlace = page(
  () => import("@/routes/AccommodationPlace"),
  "AccommodationPlace"
)
const AdminTeam = page(() => import("@/routes/AdminTeam"), "AdminTeam")
const Assistant = page(() => import("@/routes/Assistant"), "Assistant")
const Dashboard = page(() => import("@/routes/Dashboard"), "Dashboard")
const EditMyRegistration = page(
  () => import("@/routes/EditMyRegistration"),
  "EditMyRegistration"
)
const EditRegistration = page(
  () => import("@/routes/EditRegistration"),
  "EditRegistration"
)
const GuestEditor = page(() => import("@/routes/GuestEditor"), "GuestEditor")
const GuestRegister = page(
  () => import("@/routes/GuestRegister"),
  "GuestRegister"
)
const Guests = page(() => import("@/routes/Guests"), "Guests")
const Login = page(() => import("@/routes/Login"), "Login")
const Logs = page(() => import("@/routes/Logs"), "Logs")
const NewRegistration = page(
  () => import("@/routes/NewRegistration"),
  "NewRegistration"
)
const PlaceEditor = page(() => import("@/routes/PlaceEditor"), "PlaceEditor")
const PublicSchedule = page(
  () => import("@/routes/PublicSchedule"),
  "PublicSchedule"
)
const Register = page(() => import("@/routes/Register"), "Register")
const Reports = page(() => import("@/routes/Reports"), "Reports")
const RegistrationDetail = page(
  () => import("@/routes/RegistrationDetail"),
  "RegistrationDetail"
)
const Registrations = page(
  () => import("@/routes/Registrations"),
  "Registrations"
)
const Schedule = page(() => import("@/routes/Schedule"), "Schedule")
const WhatsApp = page(() => import("@/routes/WhatsApp"), "WhatsApp")
const SendMessages = page(() => import("@/routes/SendMessages"), "SendMessages")
const NewMessage = page(() => import("@/routes/NewMessage"), "NewMessage")
const MessageDetail = page(
  () => import("@/routes/MessageDetail"),
  "MessageDetail"
)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Poll explicitly where data needs to stay fresh. The global
      // refetch-on-focus is off — it would otherwise fire a burst of requests
      // every time someone alt-tabs back.
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5000,
    },
  },
})

/**
 * Lets staff through to the registration desk.
 *
 * Signed out goes to the login screen. Signed in without a staff role (anyone
 * can create an account there) stops at a waiting screen: the API would refuse
 * every request anyway, and an empty dashboard full of errors explains nothing.
 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession()

  // Render nothing rather than a redirect while the session is still being
  // resolved — redirecting first would bounce every signed-in user through
  // /login on a hard refresh.
  if (isPending) return null
  if (!session) return <Navigate to="/login" replace />
  if (!isStaff(session.user.role)) return <AccessPending />

  return <>{children}</>
}

/**
 * Admin-only screens, inside the staff area. Staff who follow a link here land
 * on the dashboard instead. This only hides the screen — every admin endpoint
 * checks the role again on the server.
 */
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  if (!isAdmin(session?.user.role)) return <Navigate to="/" replace />
  return <>{children}</>
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {/* Only the very first screen waits here; later navigations keep the
            current screen up while the next one loads. */}
        <React.Suspense fallback={null}>
          <Routes>
            <Route path="/login" element={<Login />} />
            {/* Public: devotees register here without an account. */}
            <Route path="/register" element={<Register />} />
            {/* Public: a devotee changes their own, after an OTP on the contact number. */}
            <Route path="/register/edit" element={<EditMyRegistration />} />
            {/* Public: the published schedule, the link shared with devotees. */}
            <Route path="/schedule" element={<PublicSchedule />} />
            {/* Public: shared with devotees bringing day guests. */}
            <Route path="/guests/register" element={<GuestRegister />} />
            {/* Public: an invitee may not have an account yet. */}
            <Route path="/invite/:token" element={<AcceptInvite />} />
            <Route
              element={
                <RequireAuth>
                  <AppShell />
                </RequireAuth>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="registrations" element={<Registrations />} />
              <Route path="registrations/new" element={<NewRegistration />} />
              <Route
                path="registrations/:id"
                element={<RegistrationDetail />}
              />
              <Route
                path="registrations/:id/edit"
                element={<EditRegistration />}
              />
              <Route path="accommodation" element={<Accommodation />} />
              <Route path="guests" element={<Guests />} />
              <Route path="guests/new" element={<GuestEditor />} />
              <Route path="guests/:id/edit" element={<GuestEditor />} />
              <Route
                path="accommodation/places/new"
                element={
                  <RequireAdmin>
                    <PlaceEditor />
                  </RequireAdmin>
                }
              />
              <Route
                path="accommodation/places/:id"
                element={<AccommodationPlace />}
              />
              <Route
                path="accommodation/places/:id/edit"
                element={
                  <RequireAdmin>
                    <PlaceEditor />
                  </RequireAdmin>
                }
              />
              <Route
                path="admin"
                element={
                  <RequireAdmin>
                    <AdminTeam />
                  </RequireAdmin>
                }
              />
              <Route
                path="admin/reports"
                element={
                  <RequireAdmin>
                    <Reports />
                  </RequireAdmin>
                }
              />
              <Route
                path="admin/assistant"
                element={
                  <RequireAdmin>
                    <Assistant />
                  </RequireAdmin>
                }
              />
              <Route
                path="admin/logs"
                element={
                  <RequireAdmin>
                    <Logs />
                  </RequireAdmin>
                }
              />
              <Route
                path="admin/whatsapp"
                element={
                  <RequireAdmin>
                    <WhatsApp />
                  </RequireAdmin>
                }
              />
              <Route
                path="admin/messages"
                element={
                  <RequireAdmin>
                    <SendMessages />
                  </RequireAdmin>
                }
              />
              <Route
                path="admin/messages/new"
                element={
                  <RequireAdmin>
                    <NewMessage />
                  </RequireAdmin>
                }
              />
              <Route
                path="admin/messages/:id"
                element={
                  <RequireAdmin>
                    <MessageDetail />
                  </RequireAdmin>
                }
              />
              {/* The editor. Devotees see the published copy at /schedule. */}
              <Route
                path="admin/schedule"
                element={
                  <RequireAdmin>
                    <Schedule />
                  </RequireAdmin>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </React.Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
