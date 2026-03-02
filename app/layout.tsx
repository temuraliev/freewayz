import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Oswald } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Toaster } from "@/components/ui/toaster";
import { TelegramProvider } from "@/components/providers/telegram-provider";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
});

const mono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-mono",
});

const oswald = Oswald({
  subsets: ["latin", "cyrillic"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "FreeWayz | Андерграунд стритвир",
  description: "Стритвир премиум-класса. Тёмный, андерграунд, стиль Opium. Цены в сумах (Узбекистан).",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark" suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="https://telegram.org/js/telegram-web-app.js" crossOrigin="anonymous" />
      </head>
      <body
        suppressHydrationWarning
        className={`${inter.variable} ${mono.variable} ${oswald.variable} font-sans antialiased asphalt-overlay`}
      >
        <TelegramProvider>
          <main className="min-h-screen pb-20 relative z-10">
            {children}
          </main>
          <BottomNav />
          <Toaster />
        </TelegramProvider>
      </body>
    </html>
  );
}
