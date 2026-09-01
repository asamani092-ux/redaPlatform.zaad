import type { NextConfig } from "next";

const isDockerBuild = process.env.DOCKER_BUILD === "1";

const nextConfig: NextConfig = {
  output: "standalone",
  // pdfkit يقرأ ملفات خطوط من نظام الملفات — يبقى خارج حزمة webpack
  serverExternalPackages: ["pdfkit"],
  env: {
    NEXT_PUBLIC_IDLE_TIMEOUT_MS: process.env.IDLE_TIMEOUT_MS ?? "3600000",
  },
  // lint/typecheck يعملان في CI — تجنّب OOM أثناء next build على Coolify
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: isDockerBuild },
};

export default nextConfig;
