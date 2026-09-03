import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";

/**
 * Environment lives in the workspace root `.env`, shared with the CLI scripts
 * and `drizzle-kit`. Next only auto-loads `.env` from the app directory, so it
 * is loaded here rather than duplicated into `apps/web`.
 */
const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

loadEnv({ path: resolve(workspaceRoot, ".env"), quiet: true });

const nextConfig = {
  /**
   * Where product photography is allowed to come from.
   *
   * The seeded catalog hotlinks its images to the retail listings the photos
   * were taken from rather than mirroring them, so `next/image` has to be told
   * those two hosts are expected. Anything not listed here is refused at
   * render time, which is the point — an unrecognised host in `image_url` is a
   * bug worth failing on rather than proxying.
   */
  images: {
    remotePatterns: [
      { hostname: "m.media-amazon.com", protocol: "https" },
      { hostname: "www.primeabgb.com", protocol: "https" },
    ],
  },
  transpilePackages: ["@workspace/ai", "@workspace/commerce", "@workspace/ui"],
  typedRoutes: true,
} satisfies NextConfig;

export default nextConfig;
