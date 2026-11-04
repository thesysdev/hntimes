import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The favicon: "HN" from the nameplate, white on ink.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

const germania = readFile(join(process.cwd(), "assets/fonts/GermaniaOne-Regular.ttf"));

export default async function Icon() {
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
          borderRadius: 6,
          fontFamily: "Germania One",
          fontSize: 21,
          paddingBottom: 2,
        }}
      >
        HN
      </div>
    ),
    { ...size, fonts: [{ name: "Germania One", data: await germania, weight: 400, style: "normal" }] },
  );
}
