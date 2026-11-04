import type { Metadata } from "next";
import { Geist_Mono, Libre_Franklin, Newsreader, Germania_One } from "next/font/google";
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

const germania = Germania_One({
  variable: "--font-germania",
  subsets: ["latin"],
  weight: "400",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The HN Times",
  description: "HN discussion, if it had an editor.",
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
      </body>
    </html>
  );
}
