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
  transpilePackages: ["@workspace/ai", "@workspace/ui"],
  typedRoutes: true,
} satisfies NextConfig;

export default nextConfig;
