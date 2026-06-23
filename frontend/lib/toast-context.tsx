"use client"
import { createContext, useContext, useState, useCallback, ReactNode } from "react"

export type ToastType = "success" | "error" | "warning" | "info"

export interface Toast {
  id: number
  type: ToastType
  title: string
  message?: string
}

interface ToastCtx {
  toasts: Toast[]
  success: (title: string, message?: string) => void
  error:   (title: string, message?: string) => void
  warning: (title: string, message?: string) => void
  info:    (title: string, message?: string) => void
  dismiss: (id: number) => void
}

const Ctx = createContext<ToastCtx>({
  toasts: [],
  success: () => {}, error: () => {},
  warning: () => {}, info: () => {},
  dismiss: () => {},
})

let _id = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((type: ToastType, title: string, message?: string) => {
    const id = ++_id
    setToasts(prev => [...prev, { id, type, title, message }])
    const ttl = type === "error" ? 8000 : 5000
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), ttl)
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <Ctx.Provider value={{
      toasts,
      success: (t, m) => push("success", t, m),
      error:   (t, m) => push("error",   t, m),
      warning: (t, m) => push("warning", t, m),
      info:    (t, m) => push("info",    t, m),
      dismiss,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
