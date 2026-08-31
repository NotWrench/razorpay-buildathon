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

## Current state

> The schema currently defines all of these tables in one place and
> `src/index.ts` connects only to `DATABASE_URL`, so today the agent tables are
> physically created in `razorpay_project`. The `razorpay_agent_memory` database
> is provisioned and running but still empty.

Everything below is what the split requires. It is staged rather than done
because five foreign keys cross the boundary, and a cross-database foreign key
cannot exist in Postgres:

| Column | References | Resolution |
| --- | --- | --- |
| `conversations.merchant_id` | `merchants.id` | Drop the FK; keep the uuid |
| `ai_recommendations.product_id` | `products.id` | Drop the FK; keep the uuid |
| `audit_logs.merchant_id` | `merchants.id` | Drop the FK; keep the uuid |
| `audit_logs.order_id` | `orders.id` | Drop the FK; keep the uuid |
| `failures.order_id` | `orders.id` | Drop the FK; keep the uuid |

The FKs that stay inside the agent database — `conversation_messages` and
`reasoning_logs` and `ai_recommendations` all pointing at `conversations.id` —
are unaffected.

Dropping those five trades referential integrity for the separation. That is an
acceptable trade for a log: an audit row referencing a deleted order is still a
true record of what happened, and arguably *should* survive the order. It is not
an acceptable trade for `order_items.product_id`, which is why the business
tables stay together.

## The split, when it is made

1. Give `src/index.ts` a second client from `AGENT_DATABASE_URL` and export it
   as `agentDb` alongside `db`.
2. Move the AI tables into their own drizzle config with a separate migrations
   folder (`drizzle-agent/`), dropping the five cross-boundary FKs.
3. Point the agent-side writers at `agentDb`: `packages/ai/src/persistence.ts`,
   `memory.ts`, the `recordAudit` / `recordFailure` pair in
   `packages/payments/src/audit.ts`, and the reads in
   `packages/ai/src/tools/explain.ts`.
4. Joins that currently cross the boundary — the audit trail resolving a
   merchant name, `explainDecision` reading an order — become two queries and an
   in-memory stitch. There are few of them and they are all in the trace and
   dashboard paths, never in checkout.

Because the AI layer already funnels every write through those few modules, the
change is contained to them rather than spread across the tool definitions.

## Commands

```bash
bun run db:up        # start both databases
bun run db:generate  # generate a migration from the schema
bun run db:migrate   # apply migrations
bun run db:push      # push the schema without a migration (dev only)
bun run db:studio    # drizzle studio
bun run db:down      # stop both databases
```

Migrations live in `drizzle/`. `0000` creates the schema and the `vector`
extension; `0001` adds `account.issuer`, which better-auth 1.7 requires.

## Notes

- All money is an integer count of the smallest currency unit (paise).
  `products.price`, `orders.total_amount` and `payments.amount` share that unit.
- `products.embedding` is `vector(1536)` with an HNSW cosine index. The
  embedding model must be configured to emit exactly 1536 dimensions — see
  `embeddingProviderOptions` in `@workspace/ai`.
