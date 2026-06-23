/**
 * lib/api/users.ts
 * Frontend paths:  /users
 * Backend routes:  GET /users  |  POST /users  |  DELETE /users/{username}
 */

import { BASE, authHeaders, handleResponse } from "./_core"

// ── Types ────────────────────────────────────────────────────────────────────

export interface UserRecord {
  username:  string
  full_name: string
  role:      string
  is_active: boolean
}

// ── Functions ────────────────────────────────────────────────────────────────

export async function listUsers(): Promise<{ users: UserRecord[] }> {
  const res = await fetch(`${BASE}/users`, { headers: authHeaders() })
  return handleResponse<{ users: UserRecord[] }>(res)
}

export async function addUser(body: {
  username:  string
  password:  string
  full_name: string
  role:      string
}): Promise<{ status: string; username: string }> {
  const res = await fetch(`${BASE}/users`, {
    method:  "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  })
  return handleResponse<{ status: string; username: string }>(res)
}

export async function deleteUser(username: string): Promise<{ status: string }> {
  const res = await fetch(`${BASE}/users/${username}`, {
    method:  "DELETE",
    headers: authHeaders(),
  })
  return handleResponse<{ status: string }>(res)
}
