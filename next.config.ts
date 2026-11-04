import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        // CSS Modules must keep Next's own handling, or their class names are lost.
        condition: { not: { path: "*.module.css" } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // HN serves its front page at /news too; so do we. /how-it-works was the about page's old address.
  async redirects() {
    return [
      { source: "/news", destination: "/", permanent: false },
      { source: "/how-it-works", destination: "/about", permanent: true },
    ];
  },
};

export default nextConfig;
