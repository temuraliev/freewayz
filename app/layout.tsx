import type { Metadata, Viewport } from "next";
import { Inter, Oswald } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Toaster } from "@/components/ui/toaster";
import { TelegramProvider } from "@/components/providers/telegram-provider";
import { AnalyticsProvider } from "@/components/providers/analytics-provider";
import { AdminProvider } from "@/components/admin/admin-provider";
import { QuickViewModal } from "@/components/products/quick-view-modal";
import YandexMetrica from "@/components/providers/yandex-metrica";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

const oswald = Oswald({
  subsets: ["latin", "cyrillic"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FreeWayz | Андерграунд стритвир",
  description: "Стритвир премиум-класса. Тёмный, андерграунд, стиль Opium. Цены в сумах (Узбекистан).",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FreeWayz",
  },
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
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
      </head>
      <body
        suppressHydrationWarning
        className={`${inter.variable} ${oswald.variable} font-sans antialiased asphalt-overlay`}
      >
        <TelegramProvider>
          <YandexMetrica />
          <AnalyticsProvider />
          <AdminProvider>
            <main className="min-h-screen pb-20 relative z-10">
              {children}
            </main>
            <QuickViewModal />
          </AdminProvider>
          <BottomNav />
          <Toaster />
        </TelegramProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
