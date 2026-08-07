import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  // The FastAPI backend serves the admin dashboard from backend/static.
  // Production builds must therefore emit a static `out` directory.
  ...(isProd ? { output: "export" } : {}),
  turbopack: {
    root: process.cwd(),
  },
  images: {
    unoptimized: true,
  },
  // Set up proxy rewrite in development to connect to the backend
  ...(!isProd ? {
    async rewrites() {
      return [
        {
          source: "/api/:path*",
          destination: "http://localhost:8000/api/:path*",
        },
      ];
    }
  } : {}),
};

export default nextConfig;
