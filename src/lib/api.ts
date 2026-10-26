/**
 * The only place this app talks to the backend.
 *
 * Every response from upasana-be is `{ success, data?, message?, code? }`, so
 * the unwrapping and the error shape belong here rather than at 30 call sites.
 * `credentials: "include"` on every request is what carries the Better Auth
 * session cookie — without it every call is a 401 and the reason is invisible.
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? "/api"

/**
 * A failed request, carrying the backend's own `code` where it sent one.
 *
 * The code is what lets a caller branch on *why* a request failed rather than
 * parsing the message.
 */
export class ApiError extends Error {
  // Assigned in the body rather than declared as constructor parameter
  // properties: this project compiles with `erasableSyntaxOnly`, which rejects
  // the shorthand because it emits real code rather than erasing to nothing.
  readonly status: number
  readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
  }
}

type Envelope<T> = { success: boolean; data?: T; message?: string; code?: string }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  })

  // A 500 from an unhandled throw can come back as HTML, and `.json()` on that
  // throws something far less useful than the status we already have.
  let body: Envelope<T>
  try {
    body = (await response.json()) as Envelope<T>
  } catch {
    throw new ApiError(`Request failed (${response.status})`, response.status)
  }

  if (!response.ok || !body.success) {
    throw new ApiError(body.message ?? `Request failed (${response.status})`, response.status, body.code)
  }

  return body.data as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
}

