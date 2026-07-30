import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_IDLE_TIMEOUT_MS: process.env.IDLE_TIMEOUT_MS ?? "3600000",
  },
};

export default nextConfig;
