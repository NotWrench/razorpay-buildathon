import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: "../../.env" });
config();

/**
 * Migrations for the agent database (`razorpay_agent_memory`).
 *
 * Kept separate from `drizzle.config.ts` so the two databases version
 * independently — the agent schema changes far more often than the business
 * one, and neither should force a migration on the other.
 */
const agentDatabaseUrl =
  process.env.AGENT_DATABASE_URL ||
  "postgres://postgres:postgres@localhost:5445/razorpay_agent_memory";

export default defineConfig({
  dbCredentials: {
    url: agentDatabaseUrl,
  },
  dialect: "postgresql",
  out: "./drizzle-agent",
  schema: "./src/schema/agent.ts",
});
