# Nova PC — agentic commerce on Razorpay

**Razorpay Buildathon · Track 01 — AI Growth & Agentic Commerce**

A working PC-parts store with an agent on both sides of the counter. A shopper
talks to an assistant that searches a real catalog, validates a real build and
walks a real Razorpay checkout. A merchant talks to an assistant that reads
their own sales, finds the products worth discounting, and drafts a campaign it
is not allowed to launch on its own. And a **third-party AI buyer that has never
seen this codebase** can discover the store over HTTP, read its catalog, place
an order and be told to wait for a human — because every money action here is
explainable, bounded and gated.

The track asks for one of two things. This does both:

| The track asks | Where it is |
| --- | --- |
| An agent that **grows a merchant's revenue** on Razorpay test-mode APIs | `/manager` — campaign drafting with a budget and an end date, bounded price moves, margin-aware discounting, reorder and attach-rate analysis |
| A merchant that is **transactable by an AI buyer end to end** | `GET /.well-known/agent-commerce.json` → `GET /store/{slug}/catalog.json` → `POST /api/payments/orders` → merchant approval → payment link → webhook settlement. Proven by `bun run ai-buyer` |

---

## The bar, and how it is met

> *Every money action explainable, bounded and gated. Show the audit trail and
> one failure handled gracefully.*

**Explainable.** `aiPurchaseReason` is mandatory when an agent creates an order
and is the first thing the approving merchant reads. Campaigns carry
`aiGeneratedReason`. The agent can be asked to justify itself through
`explainDecision`, and every reasoning step is persisted to `reasoning_logs`.

**Bounded.** Three layers, each catching what the others cannot:

1. **Platform limits** — `packages/ai/src/guardrails.ts`. Discounts cap at 30%,
   a single price move at 20%, two price moves per product per day, twenty line
   items per cart, and nothing may be sold below cost.
2. **Merchant policy** — `merchant_policy`, read through `getEffectivePolicy`.
   A store sets its own numbers at `/manager/account`, and the clamp only ever
   lets them be *stricter* than the platform's.
3. **Per-key caps** — an API key is issued for one store and carries the
   spending limit that merchant chose for it. Used against another store, it is
   refused.

**Gated.** Every tool that moves money returns `user-approval` and suspends the
loop for a human. An order placed by an AI buyer is created `pending_approval`
with **no payment instrument attached** — Razorpay is not called at all until a
merchant approves. `AGENT_AUTO_APPROVE_CEILING_PAISE` ships at `0`, so the
bypass exists only to show that the bound is a decision.

**The audit trail is a screen.** `/manager/activity` is one stream: human
actions, agent actions and failures interleaved, because the question a merchant
actually has is "who changed this price" and two feeds make them look twice.
Per order, `GET /api/agent/trace/{orderId}` returns the whole record.

**Failures are handled, not thrown.** Seven of them, each logged to `failures`
and `audit_logs` and surfaced as something the agent can say out loud:

| What goes wrong | What happens |
| --- | --- |
| Buyer exceeds their spend cap | `BUDGET_CHECK_FAILED` — nothing ordered, nothing charged, and the agent says by how much |
| A discount would sell below cost | `MARGIN_FLOOR_BREACHED` — the campaign is refused and the products are named |
| A key is used against the wrong store | Refused before any read |
| Razorpay refuses a refund | `REFUND_FAILED`, with Razorpay's bare `{statusCode: 404}` mapped to something actionable |
| The buyer closes the checkout window | The order is cancelled — the server decides whether it really was abandoned |
| The model searches the web off-topic | `SEARCH_GUARDRAIL_BLOCKED` |
| A campaign runs out of budget | It stops applying at quote time, without a job needing to notice |

**Test mode is enforced, not assumed.** Razorpay stamps the mode into the key
id, so an `rzp_live_` key is refused at every point credentials resolve — the
platform keys, a store's own connected account, and the checkout window in the
browser. The modal says "Test mode" and the payment record carries the same note.

---

## Setup

Requires [Bun](https://bun.sh) 1.4+ and Docker.

```bash
bun install
cp .env.example .env      # then fill in the four keys below
bun run db:up             # two Postgres 17 + pgvector containers
bun run db:migrate        # both databases
bun run seed              # Nova PC: catalog, specs, inventory, order history
bun run embed             # product embeddings for semantic search
bun run dev
```

Four values in `.env` actually matter; everything else has a working default.

| Key | Why |
| --- | --- |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Must start `rzp_test_`. A live key is refused. |
| `GEMINI_API_KEY` **or** `NVIDIA_API_KEY` | Whichever matches `AI_PROVIDER`. Without one, chat is disabled and the catalog, payments and lexical search still work. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Sign-in is Google-only. Redirect URI: `http://localhost:3000/api/auth/callback/google` |
| `SEED_OWNER_EMAIL` | Your own Google address, so the seeded store is one you can actually sign in to and own. |

Then:

- **Storefront** — <http://localhost:3000/store/nova-electronics>
- **Merchant** — <http://localhost:3000/manager>
- **Manifest** — <http://localhost:3000/.well-known/agent-commerce.json>

---

## See it work in 60 seconds

No sign-in needed for the first two.

```bash
curl -s localhost:3000/.well-known/agent-commerce.json | jq
```

Who trades here, how to authenticate, where the catalogs are, and — the part
that matters — exactly what a buying agent is and is not allowed to do. The
bounds are *published* rather than merely enforced, so a counterparty can decide
whether to engage before spending a request finding out. Each store's own
effective policy travels with it, because a merchant may be stricter than the
platform and an agent planning against the platform number would plan wrong.

```bash
curl -s localhost:3000/store/nova-electronics/catalog.json | jq '.products[0]'
```

Live prices in paise, live stock, typed specifications, a readiness score per
product, and the exact checkout call to make — enough for a buying agent to
choose a part and know whether it fits.

```bash
# Issue a key at /manager/agents, put it in AI_BUYER_API_KEY, then:
bun run ai-buyer -- --budget 30000 --want "a graphics card for 1440p gaming"
```

`scripts/ai-buyer.ts` has **no `@workspace/*` imports and no database access**.
It knows one URL and an API key; everything else it discovers over HTTP the way
a third party would. That constraint is the point — if it works, the merchant is
genuinely transactable by an AI buyer, not merely by *our* AI.

It stops at `pending_approval`, because that is what is supposed to happen.
Approve the order at `/manager/orders` and it resumes to a payment link.

---

## Architecture

```
                        ┌──────────────────────────────┐
   human buyer ────────►│  /store/{slug}    (useChat)  │
                        └───────────────┬──────────────┘
                                        │  POST /api/agent/chat
                                        ▼
   merchant ───────────►┌──────────────────────────────┐
                        │        packages/ai           │
   MCP client ─────────►│  storefront agent · merchant │
   POST /api/mcp/{slug} │  agent · shared tool loop    │
                        └───────┬──────────────┬───────┘
                     approval gate             │  read-only analytics
                   (every money tool)          │
                                ▼              ▼
   external AI buyer ──┐  ┌──────────────────────────────┐
    ├ GET catalog.json ├─►│    @workspace/payments       │──► Razorpay (test)
    └ POST /api/payments/*│  recordAudit / recordFailure │
       (x-api-key)        └──────────────┬───────────────┘
                                         ▼
                     audit_logs · reasoning_logs · failures
```

**Two databases.** The platform database (`DATABASE_URL`) is authoritative for
commerce: merchants, products, specs, inventory, carts, builds, orders,
payments, campaigns. The agent database (`AGENT_DATABASE_URL`) holds everything
the AI wrote: conversations, reasoning, recommendations, memory, the audit trail
and the failure log. Append-only data that grows per reasoning step gets its own
retention, its own load and one place to look up what the AI did. See
[`packages/db/README.md`](packages/db/README.md).

**The context rule.** No tool ever accepts `merchantId`, `buyerIdentifier`,
`userId` or a price from the model. Tools are produced by factories closing over
a server-resolved context, so authorization happens *before* execution and the
model chooses products and quantities and nothing else.

| Package | What it owns |
| --- | --- |
| `packages/ai` | Both agents, 63 tools, guardrails, policy, catalog search, embeddings, memory, audit |
| `packages/payments` | Razorpay: cart pricing, orders, approval, payment links, capture, refund, HMAC verification, idempotent webhook settlement |
| `packages/commerce` | The deterministic compatibility engine — rules with a real `insufficient_data` state, never a guess |
| `packages/db` | Drizzle schema and migrations for both databases |
| `packages/mcp` | The store's domain capabilities over MCP, scoped server-side |
| `packages/auth` | better-auth: Google sign-in for humans, API keys for agents |
| `apps/web` | Next.js 16 — storefront, manager, and every route handler |

Deeper background: [`AGENTS.md`](AGENTS.md) is the project memory (data
ownership, grounding rules, permissions). [`docs/DEMO.md`](docs/DEMO.md) is the
demo runbook. [`plans/`](plans/) holds the working plans, including a
conformance audit against this track.

---

## Testing

```bash
bun run typecheck     # every package — clean
bun run test          # 239 unit tests across three packages — clean
bun run lint          # ultracite / biome
```

`bun run lint` currently reports ~545 findings, almost all of them ultracite's
stricter formatting and sorting rules applied to code written before it was
added. They are noise rather than defects — `bun run fix` resolves most — and
they are tracked separately from correctness, which `typecheck` and `test` own.

Four end-to-end verification suites run against a live database, and three of
them against a live model. They are not part of `bun run test` because they cost
API quota and take minutes, but they are where the real assurance is:

| Suite | Proves |
| --- | --- |
| `bun run verify` | The whole agent layer: persistence, audit writes, guardrails, the gated money path |
| `bun run verify:agent` | The buyer's agent over real scenarios — grounding, quoting, refusing to invent |
| `bun run verify:manager` | 57 deterministic checks over merchant writes, bounds and failure paths |
| `bun run verify:merchant` | 33 checks against a live model, over evidence and restraint |

`verify:agent` is known to fail intermittently on scenario 2 — the model
sometimes searches twice instead of calling `quoteOrder`. It is a harness flake,
documented in [`plans/merchant-agent-plan.md`](plans/merchant-agent-plan.md).

---

## What is deliberately not here

Shipping, fulfilment and tax. Real money — test mode is enforced in code, not
just configured. And an agent that can spend without asking: the auto-approve
ceiling is `0`, and the knob exists only to prove the bound was chosen.
