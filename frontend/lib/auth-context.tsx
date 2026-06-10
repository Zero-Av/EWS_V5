"use client"
import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { useRouter } from "next/navigation"
import { getMe } from "@/lib/api"

interface AuthUser {
  username:  string
  full_name: string
  role:      "admin" | "manager"
}

interface AuthCtx {
  user:    AuthUser | null
  loading: boolean
  login:   (token: string, user: AuthUser) => void
  logout:  () => void
  isAdmin: boolean
}

const Ctx = createContext<AuthCtx>({
  user: null, loading: true,
  login: () => {}, logout: () => {}, isAdmin: false,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem("ews_token")
    if (!token) { setLoading(false); return }
    getMe()
      .then(u => setUser(u as AuthUser))
      .catch(() => { localStorage.removeItem("ews_token") })
      .finally(() => setLoading(false))
  }, [])

  const login = (token: string, u: AuthUser) => {
    localStorage.setItem("ews_token", token)
    setUser(u)
    router.push(u.role === "admin" ? "/dashboard" : "/dashboard")
  }

  const logout = () => {
    localStorage.removeItem("ews_token")
    setUser(null)
    router.push("/login")
  }

  return (
    <Ctx.Provider value={{ user, loading, login, logout, isAdmin: user?.role === "admin" }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
