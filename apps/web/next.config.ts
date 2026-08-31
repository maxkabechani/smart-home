import type { NextConfig } from "next";

const backendUrl = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/smart-home/:path*", destination: `${backendUrl}/smart-home/:path*` },
      { source: "/telemetry", destination: `${backendUrl}/telemetry` },
      { source: "/commands/:path*", destination: `${backendUrl}/commands/:path*` },
    ];
  },
};

export default nextConfig;
