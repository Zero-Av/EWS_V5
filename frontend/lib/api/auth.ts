/**
 * lib/api/auth.ts
 * Frontend paths:  /login
 * Backend routes:  POST /auth/login  |  GET /auth/me
 */

import { BASE, authHeaders, handleResponse } from "./_core"

// ── Types ────────────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string
  token_type:   string
  role:         "admin" | "analyst" | "manager"
  full_name:    string
}

export interface UserInfo {
  username:  string
  full_name: string
  role:      string
}

// ── Functions ────────────────────────────────────────────────────────────────

export async function login(
  username: string,
  password: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({ username, password })
  const res  = await fetch(`${BASE}/auth/login`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  return handleResponse<TokenResponse>(res)
}

export async function getMe(): Promise<UserInfo> {
  const res = await fetch(`${BASE}/auth/me`, { headers: authHeaders() })
  return handleResponse<UserInfo>(res)
}
