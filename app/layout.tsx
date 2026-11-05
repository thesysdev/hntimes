import type { Metadata, Viewport } from "next";
import { Geist_Mono, Libre_Franklin, Newsreader, Germania_One } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SITE } from "@/lib/site";
import { themeScript } from "@/lib/theme";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const franklin = Libre_Franklin({
  variable: "--font-franklin",
  subsets: ["latin"],
});

const germania = Germania_One({
  variable: "--font-germania",
  subsets: ["latin"],
  weight: "400",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Defaults for every page; each page sets its own canonical address (a canonical here would be
// inherited by all of them).
export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name}: ${SITE.tagline}`, template: `%s · ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  openGraph: { type: "website", siteName: SITE.name, locale: "en_US" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The theme script sets data-theme before hydration, so the attribute can differ from the server's.
    <html
      lang="en"
      className={`${newsreader.variable} ${franklin.variable} ${germania.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Script id="theme" strategy="beforeInteractive">
          {themeScript}
        </Script>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
