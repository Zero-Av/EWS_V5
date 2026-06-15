import type { Metadata } from "next"
import "./globals.css"
import { AuthProvider }  from "@/lib/auth-context"
import { ToastProvider } from "@/lib/toast-context"

export const metadata: Metadata = {
  title: "NEXUS · Employee Intelligence Platform",
  description: "AI-powered employee experience management — predict, explain, act.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
