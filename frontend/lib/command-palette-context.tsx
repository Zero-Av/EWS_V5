"use client"
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"

interface PaletteCtx {
  open:  boolean
  show:  () => void
  hide:  () => void
  toggle:() => void
}

const Ctx = createContext<PaletteCtx>({
  open: false, show: () => {}, hide: () => {}, toggle: () => {},
})

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  const show   = useCallback(() => setOpen(true),  [])
  const hide   = useCallback(() => setOpen(false), [])
  const toggle = useCallback(() => setOpen(v => !v), [])

  // ⌘K / Ctrl+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [toggle])

  return (
    <Ctx.Provider value={{ open, show, hide, toggle }}>
      {children}
    </Ctx.Provider>
  )
}

export const useCommandPalette = () => useContext(Ctx)
