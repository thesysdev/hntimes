import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

// Crawlers may read every page and share image, but not the endpoints that write editions.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/", "/api/og/"], disallow: ["/api/"] },
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
