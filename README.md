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
| A merchant that is **transactable by an AI buyer end to end** | `GET /.well-known/agent-commerce.json` → `GET /store/{slug}/catalog.json` → `POST /api/payments/orders` → merchant approval → `POST /api/payments/pay` against the buyer's own mandate → settlement. No human in the loop, and no step that only *our* agent can take. Proven by `bun run ai-buyer` |

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

**Gated — which does not mean a person clicks every time.** It means no money
moves outside an explicit, bounded, revocable and *published* authority. A
human clicking is the crudest way to satisfy that and the only one that cannot
survive agent-to-agent commerce, which is the premise of UAP, AP2 and x402.

So both sides of the counter can delegate, in numbers, in advance:

| Gate | Who delegates | The object |
| --- | --- | --- |
| Whether the merchant must approve an agent's order | Merchant | `merchant_policy`, plus a per-key ceiling on the API key they issued |
| Whether the agent may pay | Buyer | `buyer_mandates` — one store, a per-order cap, a lifetime cap, an expiry |

Everything with no delegation behind it still stops. A tool that moves money
returns `user-approval` and suspends the loop; an agent order is created
`pending_approval` with **no payment instrument attached**, and Razorpay is not
called until it clears. What changed is that "it cleared" can now mean *the
merchant said so in advance* rather than only *the merchant just clicked*.

Both delegations are published in the manifest, so a counterparty learns the
terms before spending a request discovering them. Withdrawal is one button on
the buyer's own orders page, and the next charge refuses on the mandate's own
rule — `checkMandate` reads `revokedAt` before it reads any cap.

**The audit trail is a screen.** `/manager/activity` is one stream: human
actions, agent actions and failures interleaved, because the question a merchant
actually has is "who changed this price" and two feeds make them look twice. Per
order, the trail is on the buyer's own order page and inside the merchant's
order row — every action in sequence, with each failure and the recovery that
followed sitting beside the successes rather than in a log nobody opens.
`GET /api/agent/trace/{orderId}` serves the same record to anyone else.

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
| A buyer's standing authorisation is spent | `MANDATE_EXHAUSTED` — nothing charged, the agent says how much is left and hands over a payment link |
| It lapsed before the agent used it | `MANDATE_EXPIRED` — the agent says when, and falls back to a link |
| The buyer withdrew it mid-conversation | `MANDATE_REVOKED` — the next charge refuses on the mandate's own rule, not on anything remembered |

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

It stops at `pending_approval` unless the merchant has said otherwise. Approve
the order at `/manager/orders` and it resumes — and if the buyer has authorised
the store at `/store/{slug}/orders`, it **pays and settles on its own**, then
prints what is left on the authorisation. If they have not, it prints a payment
link, because that is the honest answer when nobody delegated anything.

Withdraw the authorisation between two runs and watch the second one refuse.
That is a better demonstration of "revocable" than any paragraph here.

> **On settlement.** `payments.createRecurringPayment` needs Recurring Payments
> enabled on the Razorpay account. Where that entitlement is absent a mandate
> settles through a **simulated** instrument — and says so on the payment
> record, in the audit entry, in the API response and on the buyer's screen,
> with a payment id deliberately not `pay_`-shaped. A labelled simulation is
> honest; an unlabelled one is a lie about money.

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
| `packages/payments` | Razorpay: cart pricing, orders, approval policy, buyer mandates and unattended charging, payment links, capture, refund, HMAC verification, idempotent webhook settlement |
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
bun run test          # 253 unit tests across three packages — clean
bun run lint          # ultracite / biome
```

`bun run lint` currently reports ~542 findings, almost all of them ultracite's
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

`typecheck`, `test` and `lint` run in CI on every push and pull request
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)); the first two gate the
build and lint is advisory until its backlog reaches zero. The `verify:*` suites
stay manual — they need a live database, a seeded catalog and real model quota.

---

## The agent that runs while nobody is watching

```bash
bun run nightly                          # every store
bun run nightly -- --slug nova-electronics
```

One unattended run of the merchant agent per store: it reads two sales windows,
finds what actually moved, checks what needs a person, and leaves at most one
drafted campaign and one reorder request.

**It cannot change anything that matters, and that is structural rather than
promised.** Every money tool returns `user-approval` from the same policy the
interactive agent uses, and there is no human in an unattended run to give it —
so those tools suspend and never execute. What it leaves behind is a
`pending_approval` campaign that discounts nothing and a `draft` reorder that
buys nothing. The run prints which tools it was stopped on, and every action it
takes is audited with `scheduled: true`, so the merchant can tell "while I was
asleep" from "because I asked".

For a deployed instance, [`apps/web/vercel.json`](apps/web/vercel.json) points a
nightly cron at `/api/cron/briefing`, which does the same thing behind
`CRON_SECRET`. That route refuses to run at all when the secret is unset — a
cron endpoint that is open when misconfigured is worse than one that is broken.

---

## What is deliberately not here

Shipping, fulfilment and tax. Real money — test mode is enforced in code, not
just configured. And an agent that can spend without asking: the auto-approve
ceiling is `0`, and the knob exists only to prove the bound was chosen.
