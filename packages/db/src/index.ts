import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { agentSchema } from "./schema/agent";
import { projectSchema } from "./schema/project";

/**
 * Two databases, two clients.
 *
 * `db` holds the business: users, merchants, products, orders, payments,
 * campaigns. `agentDb` holds everything the AI writes: conversations,
 * reasoning, recommendations, memory, and the audit trail.
 *
 * They are separate because the agent tables are append-only and grow per
 * reasoning step, so they want their own retention and their own load — and
 * because "everything the AI did" being one database makes it far easier to
 * look up. The cost is that a handful of joins become two queries; see
 * `packages/db/README.md`.
 */

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

/**
 * The agent database falls back to the project database when unset.
 *
 * A missing `AGENT_DATABASE_URL` should degrade to the previous single-database
 * behaviour rather than crash the app on boot — losing the audit trail is worse
 * than sharing a database with it.
 */
const agentDatabaseUrl = process.env.AGENT_DATABASE_URL ?? databaseUrl;

export const client = postgres(databaseUrl);
export const db = drizzle({ client, schema: projectSchema });

export const agentClient =
  agentDatabaseUrl === databaseUrl ? client : postgres(agentDatabaseUrl);
export const agentDb = drizzle({ client: agentClient, schema: agentSchema });

/** True when the agent tables have a database of their own. */
export const hasDedicatedAgentDatabase = agentDatabaseUrl !== databaseUrl;

export * from "./schema/index";
export * from "./taxonomy";
