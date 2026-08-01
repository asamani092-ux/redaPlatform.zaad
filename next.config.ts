import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // pdfkit يقرأ ملفات خطوط من نظام الملفات — يبقى خارج حزمة webpack
  serverExternalPackages: ["pdfkit"],
  env: {
    NEXT_PUBLIC_IDLE_TIMEOUT_MS: process.env.IDLE_TIMEOUT_MS ?? "3600000",
  },
};

export default nextConfig;
