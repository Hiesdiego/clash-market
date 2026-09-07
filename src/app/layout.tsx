import type { Metadata, Viewport } from "next";
import { Oswald, Inter, JetBrains_Mono } from "next/font/google";
import { ClashPrivyProvider } from "@/components/providers/privy-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { AppShell } from "@/components/shell/app-shell";
import { PwaRegister } from "@/components/pwa/pwa-register";
import "./globals.css";

// Real font loading (previously the display face was a "Clash Display"
// placeholder that fell back to system sans, and Inter/JetBrains were never
// loaded at all). Each exposes a CSS variable that globals.css maps to the
// semantic --font-display / --font-body / --font-mono tokens.
const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-oswald",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_APP_URL
    ? new URL(process.env.NEXT_PUBLIC_APP_URL)
    : undefined,
  title: {
    default: "Clash Markets",
    template: "%s | Clash Markets",
  },
  applicationName: "Clash Markets",
  description:
    "Draft the market. Captain your conviction. Clash for the table. Trade live prediction markets, build squads, and compete across leagues.",
  keywords: [
    "Clash Markets",
    "prediction markets",
    "onchain prediction markets",
    "crypto prediction markets",
    "sportsbook alternative",
    "market trading game",
    "Somnia",
    "DreamDEX",
  ],
  authors: [{ name: "Clash Markets" }],
  creator: "Clash Markets",
  publisher: "Clash Markets",
  category: "finance",
  referrer: "origin-when-cross-origin",
  alternates: { canonical: "/" },
  icons: {
    icon: [
      { url: "/assets/logo/cm-logo.png", type: "image/png" },
      { url: "/assets/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: { url: "/assets/logo/cm-logo.png", type: "image/png" },
  },
  manifest: "/assets/site.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Clash Markets",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: "Clash Markets",
    title: "Clash Markets",
    description:
      "Draft the market. Captain your conviction. Clash for the table.",
    images: [
      {
        url: "/assets/logo/cm-logo.png",
        width: 1280,
        height: 1280,
        alt: "Clash Markets logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Clash Markets",
    description:
      "Draft the market. Captain your conviction. Clash for the table.",
    images: ["/assets/logo/cm-logo.png"],
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

export const viewport: Viewport = {
  themeColor: "#07110d",
  colorScheme: "dark",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${oswald.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <PwaRegister />
        <ClashPrivyProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </ClashPrivyProvider>
      </body>
    </html>
  );
}
