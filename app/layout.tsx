import type { Metadata } from "next";
import { Geist_Mono, Libre_Franklin, Newsreader, UnifrakturMaguntia } from "next/font/google";
import Script from "next/script";
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

const unifraktur = UnifrakturMaguntia({
  variable: "--font-unifraktur",
  subsets: ["latin"],
  weight: "400",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hackerpaper",
  description: "Hacker News, if it had an editor.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The theme script sets data-theme before hydration, so the attribute can differ from the server's.
    <html
      lang="en"
      className={`${newsreader.variable} ${franklin.variable} ${unifraktur.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Script id="theme" strategy="beforeInteractive">
          {themeScript}
        </Script>
        {children}
      </body>
    </html>
  );
}
