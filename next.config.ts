import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Allow customer websites to iframe the embed chat from any origin.
        source: "/embed/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
          { key: "X-Frame-Options", value: "ALLOWALL" },
        ],
      },
      {
        // The loader is a public static asset; allow long-lived caching but
        // permit revalidation. Also enable cross-origin loading explicitly.
        source: "/embed.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=300, s-maxage=300, must-revalidate",
          },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
    ];
  },
};

export default nextConfig;
