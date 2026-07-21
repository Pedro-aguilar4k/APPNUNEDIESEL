import type { Metadata, Viewport } from "next"
import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "NuneDiesel | Conferência de NF-e",
  description: "NuneDiesel Autopeças — Conferência de notas fiscais, vinculação de produtos e controle de entrada de linha pesada",
  generator: "v0.app",
}

export const viewport: Viewport = {
  themeColor: "#12134A",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${ibmPlexSans.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-background font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem storageKey="nunediesel-theme">
          {children}
          <Toaster position="top-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  )
}
