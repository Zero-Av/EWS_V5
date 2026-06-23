/**
 * lib/api/_core.ts
 * Internal fetch primitives shared by all api/* modules.
 * Not re-exported from index.ts — import directly only within lib/api/.
 */

export const BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export function token(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("ews_token")
}

export function authHeaders(): Record<string, string> {
  const t = token()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || "Request failed")
  }
  return res.json()
}
