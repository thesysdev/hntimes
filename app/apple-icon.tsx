import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The home-screen icon: "HN" from the nameplate, white on ink. iOS rounds the corners itself.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const germania = readFile(join(process.cwd(), "assets/fonts/GermaniaOne-Regular.ttf"));

export default async function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#121212",
          color: "#ffffff",
          fontFamily: "Germania One",
          fontSize: 104,
          paddingBottom: 8,
        }}
      >
        HN
      </div>
    ),
    { ...size, fonts: [{ name: "Germania One", data: await germania, weight: 400, style: "normal" }] },
  );
}
