import type { Metadata, Viewport } from "next"
import "./globals.css"
import { AuthProvider }             from "@/lib/auth-context"
import { ToastProvider }            from "@/lib/toast-context"
import { CommandPaletteProvider }   from "@/lib/command-palette-context"

export const metadata: Metadata = {
  title:       "NEXUS · Employee Intelligence Platform",
  description: "AI-powered employee experience management — predict, explain, act.",
  robots:      "noindex, nofollow",  // internal enterprise tool
}

export const viewport: Viewport = {
  width:        "device-width",
  initialScale: 1,
  themeColor:   "#2563EB",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[999]
                     focus:bg-accent focus:text-white focus:px-4 focus:py-2 focus:rounded-lg
                     focus:text-sm focus:font-semibold"
        >
          Skip to main content
        </a>
        <AuthProvider>
          <ToastProvider>
            <CommandPaletteProvider>
              {children}
            </CommandPaletteProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
