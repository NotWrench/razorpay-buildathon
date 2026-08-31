# @workspace/db

Drizzle schema and client. Two Postgres instances, both `pgvector/pgvector:pg17`,
brought up by `bun run db:up`.

| Database | Port | Container | Holds |
| --- | --- | --- | --- |
| `razorpay_project` | 5443 | `razorpay-buildathon-project-db` | Business and auth data: `user`, `session`, `account`, `apikey`, `merchants`, `products`, `orders`, `order_items`, `payments`, `campaigns` |
| `razorpay_agent_memory` | 5445 | `razorpay-buildathon-agent-db` | Everything the AI agents write: `conversations`, `conversation_messages`, `reasoning_logs`, `ai_recommendations`, `agent_memory_long`, `audit_logs`, `failures` |

## Why the agent data is separate

The agent tables are append-only and grow far faster than the business tables —
a single shopping conversation writes a reasoning row per step and an audit row
per tool call. Keeping them in their own database means:

- **Lookup is simpler.** "Everything the AI did" is one database, not a set of
  tables you have to remember to filter out of the business schema.
- **Retention is independent.** Conversation logs can be pruned or archived on
  their own schedule without touching orders or payments, which have to be kept.
- **Load is isolated.** Trawling the audit trail for a demo, or replaying a
  reasoning chain, never contends with checkout traffic.
- **Blast radius is smaller.** The agent writes heavily to its own database and
  only ever reads the business one.

## The cross-database foreign keys

Five foreign keys used to cross the boundary. Postgres cannot reference across
databases, so they are now plain uuid columns:

| Column | Used to reference | Now |
| --- | --- | --- |
| `conversations.merchant_id` | `merchants.id` | uuid |
| `ai_recommendations.product_id` | `products.id` | uuid |
| `audit_logs.merchant_id` | `merchants.id` | uuid |
| `audit_logs.order_id` | `orders.id` | uuid |
| `failures.order_id` | `orders.id` | uuid |

The three that stay inside the agent database — `conversation_messages`,
`reasoning_logs` and `ai_recommendations` all pointing at `conversations.id` —
are still enforced.

Dropping those five trades referential integrity for the separation, and for a
log that is the right trade: an audit row referencing a deleted order is still a
true record of what happened, and arguably *should* outlive the order. It would
not be an acceptable trade for `order_items.product_id`, which is why the
business tables stay together.

## Using the two clients

```ts
import { agentDb, db } from "@workspace/db";

await db.select().from(orders);          // project database
await agentDb.select().from(auditLogs);  // agent database
```

Both are exported from `@workspace/db`, as is every table, so which database a
table belongs to is not visible at the import. Reaching for the wrong client
fails against a database that has no such table, so the split is enforced at
runtime rather than by convention.

Agent writes are funnelled through a small number of modules, which is what kept
the change contained:

| Module | Writes |
| --- | --- |
| `@workspace/payments` `src/audit.ts` | `audit_logs`, `failures` |
| `@workspace/ai` `src/persistence.ts` | `conversations`, `conversation_messages`, `reasoning_logs` |
| `@workspace/ai` `src/memory.ts` | `agent_memory_long` |
| `@workspace/ai` `src/context.ts` | `conversations` |
| `@workspace/ai` `src/tools/shopping.ts` | `ai_recommendations` |

Reads that need both — the order trace, `explainDecision` — run two queries and
stitch in memory. In both cases ownership is established against the project
database *first*, so no agent record is read before the caller's right to see it
is checked. Neither path is on the checkout hot path.

If `AGENT_DATABASE_URL` is unset, `agentDb` falls back to the project
connection. Losing the audit trail is worse than sharing a database with it, so
a missing variable degrades rather than crashes. `hasDedicatedAgentDatabase`
reports which mode is in effect.

## Commands

```bash
bun run db:up            # start both databases
bun run db:generate      # generate migrations for both from the schema
bun run db:migrate       # apply migrations to both
bun run db:push          # push both schemas without a migration (dev only)
bun run db:studio        # drizzle studio, project database
bun run db:studio:agent  # drizzle studio, agent database
bun run db:down          # stop both databases
```

Each database has its own migration folder and its own drizzle config, so they
version independently — the agent schema changes far more often than the
business one and neither should force a migration on the other. `db:generate`,
`db:migrate` and `db:push` each run against both.

| Folder | Config | Database |
| --- | --- | --- |
| `drizzle/` | `drizzle.config.ts` | `razorpay_project` |
| `drizzle-agent/` | `drizzle.agent.config.ts` | `razorpay_agent_memory` |

Project migrations: `0000` creates the schema and the `vector` extension, `0001`
adds `account.issuer` for better-auth 1.7, and `0002` drops the agent tables
after they moved. Agent migrations start at `0000` with all seven tables.

## Notes

- All money is an integer count of the smallest currency unit (paise).
  `products.price`, `orders.total_amount` and `payments.amount` share that unit.
- `products.embedding` is `vector(1536)` with an HNSW cosine index. The
  embedding model must be configured to emit exactly 1536 dimensions — see
  `embeddingProviderOptions` in `@workspace/ai`.
