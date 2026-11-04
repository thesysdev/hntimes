import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

// The paper's fixed pages. Editions live at HN's own item ids and are found through the front page.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE.url, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE.url}/about`, changeFrequency: "monthly", priority: 0.5 },
  ];
}
