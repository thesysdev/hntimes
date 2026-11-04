import { ogImage, OG_SIZE } from "@/lib/og";
import { SITE } from "@/lib/site";

// The share image for the front page and the about page. Editions have their own (app/api/og).
export const alt = `${SITE.name}: ${SITE.tagline}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogImage({
    title: "Hacker News discussions, written up as news",
    dek: "What the link is, who argued what, where readers agreed and what’s still open.",
    large: true,
  });
}
