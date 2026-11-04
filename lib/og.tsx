import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE } from "./site";

// Share images: a newspaper front in miniature, the nameplate over the story's headline. Fonts are
// TTF copies of the page's own (assets/fonts), read once.

export const OG_SIZE = { width: 1200, height: 630 };

const font = (file: string) => readFile(join(process.cwd(), "assets/fonts", file));
const fonts = Promise.all([
  font("GermaniaOne-Regular.ttf"),
  font("Newsreader-Display-Bold.ttf"),
  font("Newsreader-Text-Regular.ttf"),
  font("LibreFranklin-Bold.ttf"),
]).then(([germania, display, text, franklin]) => [
  { name: "Germania One", data: germania, weight: 400 as const, style: "normal" as const },
  { name: "Newsreader Display", data: display, weight: 700 as const, style: "normal" as const },
  { name: "Newsreader", data: text, weight: 400 as const, style: "normal" as const },
  { name: "Libre Franklin", data: franklin, weight: 700 as const, style: "normal" as const },
]);

const INK = "#121212";
const INK_2 = "#363636";
const INK_3 = "#727272";
const PAPER = "#ffffff";

type Card = {
  /** The section label over the headline. */
  kicker?: string | null;
  title: string;
  dek?: string | null;
  /** A line at the foot, such as the story's points and comments. */
  footer?: string | null;
  /** Bigger type, for the site's own card. */
  large?: boolean;
};

/** A share image: the nameplate, then the kicker, headline and dek. */
export async function ogImage({ kicker, title, dek, footer, large }: Card, init?: ResponseInit) {
  const titleSize = large ? 76 : title.length > 70 ? 56 : title.length > 45 ? 64 : 72;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: PAPER,
          color: INK,
          padding: "44px 72px 52px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontFamily: "Germania One", fontSize: large ? 120 : 64, lineHeight: 1 }}>{SITE.name}</div>
          {/* The folio: the motto between a hairline and a heavy-over-thin double rule. */}
          <div
            style={{
              display: "flex",
              width: "100%",
              justifyContent: "center",
              marginTop: 18,
              padding: "10px 0",
              borderTop: `2px solid ${INK}`,
              borderBottom: `2px solid ${INK}`,
              fontFamily: "Newsreader",
              fontSize: 24,
              color: INK_3,
            }}
          >
            {SITE.tagline}
          </div>
          <div style={{ display: "flex", width: "100%", marginTop: 3, borderTop: `2px solid ${INK}` }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center", paddingTop: 24 }}>
          {kicker && (
            <div
              style={{
                fontFamily: "Libre Franklin",
                fontSize: 22,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              {kicker}
            </div>
          )}
          <div
            style={{
              fontFamily: "Newsreader Display",
              fontSize: titleSize,
              lineHeight: 1.06,
              letterSpacing: -1,
              textAlign: large ? "center" : "left",
              justifyContent: large ? "center" : "flex-start",
              display: "flex",
            }}
          >
            {title}
          </div>
          {dek && (
            <div
              style={{
                fontFamily: "Newsreader",
                fontSize: 30,
                lineHeight: 1.3,
                color: INK_2,
                marginTop: 20,
                textAlign: large ? "center" : "left",
                justifyContent: large ? "center" : "flex-start",
                display: "flex",
                // Long deks are cut at three lines.
                lineClamp: 3,
              }}
            >
              {dek}
            </div>
          )}
        </div>
        {footer && (
          <div style={{ display: "flex", fontFamily: "Libre Franklin", fontSize: 20, color: INK_3 }}>{footer}</div>
        )}
      </div>
    ),
    { ...OG_SIZE, fonts: await fonts, ...init },
  );
}
