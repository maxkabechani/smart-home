import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://temp.maxkabechani.dev";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Smart Home",
    template: "%s | Smart Home",
  },
  description: "Realtime ESP32 smart-home monitoring, automation, and control.",
  applicationName: "Smart Home",
  keywords: [
    "ESP32",
    "IoT dashboard",
    "home automation",
    "security",
    "lighting",
    "real-time monitoring",
  ],
  authors: [{ name: "Max Kashela Kabechani" }],
  creator: "Max Kashela Kabechani",
  publisher: "Max Kashela Kabechani",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Smart Home",
    description: "Realtime ESP32 smart-home monitoring, automation, and control.",
    url: "/",
    siteName: "Smart Home",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Smart Home",
    description: "Realtime ESP32 smart-home monitoring, automation, and control.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport = {
  themeColor: "#f7f4ef",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("h-full antialiased", "font-sans")}>
      <body className="min-h-full flex flex-col">
        <Providers>
          <TooltipProvider>{children}</TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
