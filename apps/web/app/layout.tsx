import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://temp.maxkabechani.dev";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ESP32 Monitor",
    template: "%s | ESP32 Monitor",
  },
  description: "Live temperature and humidity readings from ESP32 sensors.",
  applicationName: "ESP32 Monitor",
  keywords: [
    "ESP32",
    "IoT dashboard",
    "temperature",
    "humidity",
    "sensor readings",
    "real-time monitoring",
  ],
  authors: [{ name: "Max Kashela Kabechani" }],
  creator: "Max Kashela Kabechani",
  publisher: "Max Kashela Kabechani",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "ESP32 Monitor",
    description: "Live temperature and humidity readings from ESP32 sensors.",
    url: "/",
    siteName: "ESP32 Monitor",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "ESP32 Monitor",
    description: "Live temperature and humidity readings from ESP32 sensors.",
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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
