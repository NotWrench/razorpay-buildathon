import type { NextConfig } from "next";

const nextConfig = {
  transpilePackages: ["@workspace/ui"],
  typedRoutes: true,
} satisfies NextConfig;

export default nextConfig;
