"use client"
import { ReactNode } from "react"
import Sidebar  from "@/components/layout/Sidebar"
import TopBar   from "@/components/layout/TopBar"
import ToastContainer from "@/components/ui/ToastContainer"

interface AppShellProps {
  children: ReactNode
  // Legacy props — kept for backward compatibility, now ignored
  activeTab?: string
  onTabChange?: (tab: string) => void
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-layout">
      <Sidebar />

      <div className="main-content flex flex-col">
        <TopBar />

        <main
          id="main-content"
          className="flex-1 overflow-auto"
          aria-label="Main content"
        >
          {children}
        </main>
      </div>

      <ToastContainer />
    </div>
  )
}
