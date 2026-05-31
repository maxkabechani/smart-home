import type { NextConfig } from "next";

const backendUrl = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
