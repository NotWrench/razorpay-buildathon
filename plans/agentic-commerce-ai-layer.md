# Plan — Agentic Commerce AI Layer (Vercel AI SDK + tool calls)

**Track:** AI Growth & Agentic Commerce
**Goal:** an agent that grows a merchant's revenue on Razorpay test-mode APIs, *and* makes
that merchant transactable by an AI buyer end to end.
**The bar:** every money action explainable, bounded and gated; a visible audit trail; one
failure handled gracefully.

> Scope of this plan: the AI/agent layer. Payments, database schema and auth already exist
> in the repo and are not rebuilt.

---

## 1. What already exists

| Layer | Status |
| --- | --- |
| `packages/db` | Drizzle/Postgres schema: `merchants`, `products` (with `vector(1536)` + HNSW cosine index), `orders`, `order_items`, `payments`, `campaigns`, `conversations`, `conversation_messages`, `ai_recommendations`, `agent_memory_long`, `reasoning_logs`, `audit_logs`, `failures` |
| `packages/payments` | Full Razorpay integration — cart pricing, order persistence, merchant approval, Razorpay order creation, payment links, capture, refund, HMAC signature verification, idempotent webhook settlement, plus `recordAudit` / `recordFailure` |
| `packages/auth` | better-auth, email/password + **API keys** (`x-api-key`) — already the identity boundary between a human buyer and an external AI buyer |
| `apps/web/app/api/payments/*` | 10 zod-validated endpoints with a uniform `{success, data}` / `{success, error}` envelope |
| `apps/web/lib/api/*` | `resolveActor` (`human` vs `ai_agent`), `assertMerchantOwner`, `handleRouteError` |

**Constraints inherited from that code — the AI layer must respect them:**

- All money is **integer paise** (`products.price`, `orders.totalAmount`, `payments.amount`).
- `createCheckoutOrder` already implements the gate: `buyerType: "human"` → auto-approved;
  `buyerType: "ai_agent"` → `approval_status = pending_approval`, `checkout: null`. Razorpay
  is never called until a merchant hits `/approve`. **Agent tools go through this, never around it.**
- `recordAudit` / `recordFailure` are the single write path for the audit trail.
- `orders.aiPurchaseReason` and `campaigns.aiGeneratedReason` are explainability columns that
  already exist and are currently unwritten. The agent fills them.
- `packages/payments/README.md` documents every endpoint and the webhook contract.

**Gaps blocking a demo (Phase 0 closes them):**

1. No product CRUD and no seed data — the catalog is empty.
2. No merchant onboarding, so no `merchants` row exists and nothing is addressable by slug.
3. `products.embedding` exists but nothing writes it.
4. `AGENT_DATABASE_URL` is in `.env.example` but `packages/db/src/index.ts` only reads
   `DATABASE_URL`, so the AI tables are physically created in the project DB.
   **Decision: keep the two databases** — `razorpay_agent_memory` (port 5445) is the
   home for conversations, reasoning logs, the audit trail and agent memory, so
   "everything the AI did" is one database to look in, with its own retention and
   its own load. The connection is not split yet; `packages/db/README.md` records
   what the split needs, including the five cross-boundary foreign keys that have
   to be dropped for it.
5. `conversations`, `conversation_messages`, `reasoning_logs`, `agent_memory_long` have no writers.
6. No UI at all — `apps/web/app/page.tsx` is still the scaffold.

---

## 1b. Reconciliation with project memory (`AGENTS.md`)

Where this plan and the project memory disagree, the option kept and why:

| Point | Project memory | This plan | Kept |
| --- | --- | --- | --- |
| Backend / AI runtime | FastAPI + LangGraph, OpenAI GPT | Next.js route handlers + Vercel AI SDK | **Plan.** The repo is a bun/turbo TypeScript monorepo with zero Python; `packages/payments` and better-auth are already TS. A second runtime buys nothing and costs the whole hackathon. *`AGENTS.md`'s Tech Stack section is stale and should be corrected.* |
| Merchant connects Razorpay | Explicit step in the merchant journey | Absent | **Memory.** `merchants.razorpayKeyId` / `razorpayKeySecret` and `resolveMerchantCredentials` already support per-merchant credentials with platform-key fallback. Added to Phase 0. |
| Agent database | Two databases (project + agent memory) | Collapse to one | **Memory.** The agent tables are append-only and grow per reasoning step, so a separate `razorpay_agent_memory` gives independent retention, isolated load and a single place to look up what the AI did. Both containers ship in `compose.yml`; see `packages/db/README.md`. |
| `agent_memory_short` table | Listed | Not used | **Plan.** Short-term state (budget, current intent, category) is derivable from the live conversation inside one request; a table adds writes and an expiry job for no demo value. Long-term memory stays in `agent_memory_long`. |
| `tool_calls` table | Listed | `conversation_messages.tool_calls` jsonb + `audit_logs` | **Plan.** The column already exists and every money-relevant call is separately audited. |
| `agent_events` table | Listed | `audit_logs` | **Plan.** One append-only trail is easier to defend on stage than two. |
| `analytics_daily` table | Listed | Computed on read | **Plan.** At demo scale, aggregating `orders` / `order_items` live is instant and never stale. Revisit only if the dashboard feels slow. |
| `customers` table | Listed | better-auth `user` + `orders.buyerIdentifier` | **Plan.** Already models both humans and API-key agents. |
| Catalog path | flat `/catalog.json` | `/api/store/[slug]/catalog.json` | **Plan**, with memory's ergonomics — the platform is multi-tenant so the slug is required, but `/store/[slug]/catalog.json` is served as a clean alias and is the URL advertised in the manifest. |
| "AI never performs autonomous payments" | Hard rule | `AGENT_AUTO_APPROVE_CEILING_PAISE` allowed a sub-threshold bypass | **Memory.** The ceiling ships at `0`, so *every* money action is gated by default. The knob stays only to demonstrate that the bound is a deliberate policy, not an accident. |
| Campaign output | "predict revenue improvements" | title, reason, discount | **Memory.** `draftCampaign` also returns a projected impact (units, revenue delta) with its assumptions stated. |
| `CONVERSATION_STARTED` audit event | Listed | Missing from the action list | **Memory.** Added. |
| Failure recovery options | Retry / payment link / cancel | Retry / payment link / find cheaper | **Both.** All four offered; cancel writes `ORDER_CANCELLED` and releases the order. |
| Explainability, approval gates, audit trail, "never hide AI decisions" | Principles | Concrete mechanisms | **Both.** The memory's principles are the acceptance criteria; §5 and §6 are how they are enforced. |

---

## 2. Target architecture

```
                       ┌────────────────────────────┐
  human buyer ───────► │  /store/[slug]  (useChat)  │
                       └──────────────┬─────────────┘
                                      │ POST /api/agent/chat
                                      ▼
                       ┌──────────────────────────────┐
                       │  packages/ai                 │
                       │  shopping agent │ merchant   │
                       │      tool loop  │   agent    │
                       └───────┬──────────────┬───────┘
                     toolApproval gate        │ read-only analytics
                    (money actions only)      │
                               ▼              ▼
  external AI buyer ──┐  ┌──────────────────────────┐
   ├ GET catalog.json ├─►│  @workspace/payments     │──► Razorpay (test mode)
   └ POST /api/payments/*│  recordAudit/recordFail  │
      (x-api-key)        └────────────┬─────────────┘
                                      ▼
                          audit_logs · reasoning_logs · failures
```

Two agents over one shared tool infrastructure:

- **Shopping agent** — conversational in-app checkout for the human buyer, with upsell and
  cross-sell. Covers *conversational checkout* + *upsell agent*.
- **Merchant agent** — sales analysis, slow-mover detection, campaign drafting, order approval
  queue. Covers *campaign orchestrator*.

An **external AI buyer** does not use our agent at all: it reads a machine-readable catalog and
calls the payments HTTP API with an API key. That path already works server-side; Phase 4 makes
it discoverable and ships a reference buyer that proves it end to end.

---

## 3. New package: `packages/ai`

```
packages/ai/
  package.json          deps: ai, @ai-sdk/openai, @ai-sdk/react (peer),
                              zod (catalog:), @workspace/db, @workspace/payments
  src/
    provider.ts         model registry + env validation
    context.ts          AgentContext: merchantId, actor, conversationId — closure-injected
    guardrails.ts       spend caps, quantity caps, discount caps, merchant scoping
    persistence.ts      conversation / message / reasoning-log writers
    memory.ts           agent_memory_long read + write
    catalog.ts          product search (pgvector + lexical fallback), catalog.json serializer
    embeddings.ts       embedMany over products + backfill script
    tools/
      shopping.ts       search / recommend / upsell / quote
      checkout.ts       createOrder / createPaymentLink / orderStatus   ← gated
      merchant.ts       sales summary / slow movers / attach rate
      campaigns.ts      draftCampaign / activateCampaign                ← gated
      explain.ts        explainDecision / getAuditTrail
      index.ts
    agents/
      shopping.ts       system prompt + tool assembly
      merchant.ts       system prompt + tool assembly
    index.ts
```

### 3.1 The context rule (the most important design decision)

**No tool ever accepts `merchantId`, `buyerIdentifier`, `userId`, or a price from the model.**
Tools are produced by factories closing over a server-resolved context:

```ts
// context.ts
export interface AgentContext {
  actor: Actor;             // from resolveActor()
  conversationId: string;
  merchantId: string;       // from the route (store slug / session) — never from the LLM
  spendCapPaise: number;    // per-conversation bound
}

// tools/checkout.ts
export function checkoutTools(ctx: AgentContext) {
  return {
    createOrder: tool({
      description: "Create a pending order for the current cart. Charges nobody.",
      inputSchema: z.object({
        items: z.array(z.object({
          productId: z.uuid(),
          quantity: z.number().int().min(1).max(10),
          isUpsell: z.boolean().default(false),
        })).min(1).max(20),
        reason: z.string().min(20).max(2000)
          .describe("Why this cart: what the buyer asked for and why each item matches."),
      }),
      execute: async ({ items, reason }) => {
        await assertWithinCaps(ctx, items);
        return createCheckoutOrder({
          aiPurchaseReason: reason,
          buyerIdentifier: ctx.actor.identifier,
          buyerType: ctx.actor.type,
          items,
          merchantId: ctx.merchantId,
          userId: ctx.actor.userId,
        });
      },
    }),
  } satisfies ToolSet;
}
```

The model picks *which products and how many*. Pricing, totals, discounts and identity are
computed server-side by `priceCart` — the LLM structurally cannot invent a price.

### 3.2 Model provider

Default to the AI Gateway string form (`openai/gpt-4o`, swappable to
`anthropic/claude-sonnet-4-6`) so no provider package is hard-wired. `provider.ts` exports
`chatModel()` / `fastModel()` / `embeddingModel()`, so a swap is one file. Embeddings:
`text-embedding-3-small` — 1536 dims, matching the existing column exactly.

New env, appended to `.env.example`:

```bash
AI_GATEWAY_API_KEY=              # or OPENAI_API_KEY
AI_CHAT_MODEL=openai/gpt-4o
AI_EMBEDDING_MODEL=openai/text-embedding-3-small
AGENT_SPEND_CAP_PAISE=5000000    # ₹50,000 per conversation
AGENT_AUTO_APPROVE_CEILING_PAISE=0   # 0 = every money action is gated. Ships at 0.
```

Add `ai` and `@ai-sdk/*` to the root workspace catalog, matching the existing convention.

---

## 4. Tool catalog

Amounts in paise throughout. Every tool returns a **structured object**, not prose, so the UI
can render product cards, price breakdowns and confidence badges from typed tool parts.

### Shopping agent

| Tool | Gated | Returns | Notes |
| --- | --- | --- | --- |
| `searchProducts` | no | `{products[], strategy}` | pgvector cosine over `products.embedding` with `ILIKE` + category fallback; filters `budgetMaxPaise`, `category`, `inStockOnly`; always scoped to `ctx.merchantId` |
| `getProduct` | no | product + live stock | |
| `recommendProducts` | no | `{recommendations[{productId, reason, confidence}]}` | **writes `ai_recommendations`** (`reason`, `confidence_score`, type `search_result`) |
| `suggestUpsell` | no | same shape, type `upsell` / `bundle` | ranked from co-purchase counts in `order_items` plus category adjacency; LLM reasoning fills in when history is thin |
| `quoteOrder` | no | `{lines[], subtotal, discount, appliedCampaign, total, explanation}` | **the explainability money-shot.** Pure computation, no writes, no charge |
| `recallPreferences` | no | memory rows | `agent_memory_long` keyed by `buyerIdentifier` |
| `rememberPreference` | no | ok | writes memory with an `importance_score` |
| `createOrder` | **yes** | `{orderId, total, approvalStatus, breakdown}` | → `createCheckoutOrder` |
| `createPaymentLink` | **yes** | `{url, expiresAt}` | → `createPaymentLinkForOrder`; approved orders only |
| `getOrderStatus` | no | order + payment attempts + failures | powers graceful recovery |
| `explainDecision` | no | reasoning chain + audit trail for an order | |

### Merchant agent

| Tool | Gated | Notes |
| --- | --- | --- |
| `getSalesSummary` | no | revenue, order count, AOV, paid vs failed over a window |
| `findSlowMovers` | no | products holding stock with low or zero units sold |
| `getAttachRate` | no | how often product B sells alongside product A, from `order_items` — the input to bundle suggestions |
| `getAgentOrderQueue` | no | orders where `approval_status = pending_approval` |
| `draftCampaign` | no | inserts a `campaigns` row as `draft` with `ai_generated_reason` + `trigger_rules`; discount clamped by guardrails; returns a **projected impact** (units, revenue delta, margin effect) with its assumptions stated so the merchant can judge the estimate |
| `activateCampaign` | **yes** | → `active`, `approved_by_merchant = true`, audit `CAMPAIGN_APPROVED` |
| `approveAgentOrder` / `rejectAgentOrder` | **yes** | → existing `approveOrder` / `rejectOrder` |
| `getAuditTrail` | no | `audit_logs` + `failures` for the merchant |

---

## 5. Explainable, bounded, gated

Three deliberately redundant enforcement layers.

**1. Gate — AI SDK tool approval.** Money tools suspend the agent loop and emit an
`approval-requested` part that the UI renders as an explicit confirm card. Approval is
input-dependent, not blanket:

```ts
const result = streamText({
  model: chatModel(),
  instructions: shoppingSystemPrompt(ctx),
  messages: await convertToModelMessages(messages),
  tools: shoppingTools(ctx),
  stopWhen: isStepCount(8),
  toolApproval: {
    // autoApproveCeiling ships at 0, so this is always 'user-approval'.
    createOrder: async ({ items }) =>
      (await quoteTotal(ctx, items)) > ctx.autoApproveCeiling ? 'user-approval' : undefined,
    createPaymentLink: () => 'user-approval',
    activateCampaign: () => 'user-approval',
  },
});
```

The project memory's rule — *the AI never performs an autonomous payment* — is the default
configuration, not merely a convention: with the ceiling at `0`, every money action stops for
a human. The knob exists to show the bound is deliberate and tunable.

> API note: `needsApproval` on the tool definition is **deprecated in AI SDK 7** in favour of
> the `toolApproval` setting on `streamText` / `ToolLoopAgent`. Use `toolApproval`. Likewise
> `stopWhen: isStepCount(n)`, and responses go out via
> `createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) })`.

**2. Gate — the database.** Even if a tool somehow ran unapproved, an `ai_agent` order lands
as `pending_approval` with `checkout: null` and no Razorpay call. This is the gate that
actually protects money, and it already exists in `packages/payments`.

**3. Bounds — `guardrails.ts`, checked inside `execute` before any write:**

- per-conversation spend cap (`AGENT_SPEND_CAP_PAISE`) and a per-order ceiling
- max 20 line items, max quantity 10 per line
- campaign discount ≤ 30% and never below a cost floor
- live stock check (`priceCart` already throws `OUT_OF_STOCK`)
- merchant scoping on every query — an agent serving merchant A cannot read merchant B
- violations throw `PaymentError`, which `recordFailure` logs and the agent then explains

**Explainability.** The system prompt requires `quoteOrder` before `createOrder`, and its
breakdown renders as a table (subtotal / discount + which campaign / total). `reason` is a
required tool input with a minimum length and lands in `orders.aiPurchaseReason`.
`onStepFinish` writes a `reasoning_logs` row per step (`step_number`, `thought_summary`,
`action_taken`, `confidence`).

---

## 6. Persistence and audit wiring

Per agent turn:

1. Route resolves actor + merchant, upserts a `conversations` row → `conversationId`.
2. User message → `conversation_messages`.
3. `onStepFinish` → one `reasoning_logs` row, plus a `conversation_messages` row carrying the
   `tool_calls` JSON.
4. Each tool's `execute` → `recordAudit({ action, actorType: 'ai_assistant' | 'external_ai_agent', explanation, metadata })`.
5. Each caught error → `recordFailure({ errorType, errorMessage, recoveryAction })`.
6. `onFinish` → assistant message persisted.

New audit actions to standardise alongside the existing `ORDER_CREATED`, `ORDER_APPROVED`,
`RAZORPAY_ORDER_CREATED`, `ORDER_REJECTED`: `CONVERSATION_STARTED`, `AGENT_SEARCH`,
`AGENT_RECOMMENDED`, `AGENT_QUOTED`, `AGENT_ORDER_REQUESTED`, `APPROVAL_REQUESTED`,
`APPROVAL_GRANTED`, `APPROVAL_DENIED`, `BUDGET_CHECK_FAILED`, `ORDER_CANCELLED`,
`CAMPAIGN_DRAFTED`, `CAMPAIGN_APPROVED`.

**Short-term memory** (budget, current intent, preferred category) is held in the live
conversation for the duration of a request and distilled into `agent_memory_long` only when
`rememberPreference` judges it durable — no separate short-memory table, no expiry job.

---

## 7. Making the merchant sellable to AI buyers

| Route / artefact | Purpose |
| --- | --- |
| `GET /store/[slug]/catalog.json` | Agent-readable catalog: id, name, description, brand, category, `price_paise`, currency, stock, attributes, and the exact checkout call to make. `ETag` + `Cache-Control`, paginated. This clean path is what the manifest advertises; `/api/store/[slug]/catalog.json` serves the same handler |
| `GET /.well-known/agent-commerce.json` | Capability manifest: auth scheme (`x-api-key`), endpoint map, currency, `approval_required: true`, cap disclosure, webhook semantics — the discovery handshake an ACP/AP2-style buyer expects |
| `GET /api/store/[slug]/openapi.json` | Machine-readable spec of the buyer-facing endpoints, generated from the existing zod schemas |
| `scripts/ai-buyer.ts` | **Reference autonomous buyer.** A separate tool-loop agent that only knows HTTP: fetch manifest → fetch catalog → pick under budget → `POST /api/payments/orders` with `x-api-key` and a stated reason → poll until the merchant approves → `POST /api/payments/links` → print the link. Proves AI-to-AI commerce with no human in the buying loop and a human only at the merchant's gate |

---

## 8. HTTP routes to add (`apps/web`)

```
app/api/agent/chat/route.ts                    POST  shopping agent (streamed)
app/api/agent/merchant/route.ts                POST  merchant agent (streamed)
app/api/agent/trace/[orderId]/route.ts         GET   audit + reasoning trace for one order
app/api/merchants/route.ts                     POST  onboarding (creates merchant + slug)
app/api/merchants/razorpay/route.ts            PUT   connect Razorpay (store merchant keys)
app/api/products/route.ts                      GET|POST   merchant product CRUD
app/api/products/[id]/route.ts                 PATCH|DELETE
app/api/campaigns/route.ts                     GET|POST
app/api/campaigns/[id]/approve/route.ts        POST
app/store/[slug]/catalog.json/route.ts         GET   (advertised path)
app/api/store/[slug]/catalog.json/route.ts     GET   (same handler, api-prefixed)
app/.well-known/agent-commerce.json/route.ts   GET
```

Chat route shape:

```ts
export const maxDuration = 30;

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const actor = await resolveActor(req);
    if (!actor) return unauthorized();

    const { messages, slug } = bodySchema.parse(await req.json());
    const ctx = await buildContext({ actor, slug });   // merchantId resolved server-side

    const result = streamText({
      model: chatModel(),
      instructions: shoppingSystemPrompt(ctx),
      messages: await convertToModelMessages(messages),
      tools: shoppingTools(ctx),
      stopWhen: isStepCount(8),
      toolApproval: moneyActionApproval(ctx),
      onStepFinish: (step) => logReasoning(ctx, step),
      onFinish: ({ messages: out }) => persistTurn(ctx, out),
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream }),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
```

Client: `useChat` with `DefaultChatTransport`, `sendAutomaticallyWhen:
lastAssistantMessageIsCompleteWithApprovalResponses`, and `addToolApprovalResponse` wired to
the Approve / Deny buttons on the confirm card. Export `InferUITools` from the route so tool
parts are fully typed in the UI.

---

## 9. UI

**Storefront `/store/[slug]`**

- chat pane plus a product grid driven by `tool-searchProducts` / `tool-recommendProducts` parts
- **recommendation card** — image, name, price, reason, confidence badge
- **quote card** from `tool-quoteOrder` — line items, subtotal, discount and which campaign, total
- **approval card** from the `approval-requested` state — full breakdown, Approve / Deny
- **failure card** — reason plus four recovery buttons (Retry / Payment link / Find cheaper / Cancel)
- Razorpay Checkout opened from the `checkout` handoff; `POST /api/payments/verify` on success

**Dashboard `/dashboard`**

- merchant chat pane
- pending agent-order queue, showing each order's `aiPurchaseReason`, with Approve / Reject
- campaign inbox: AI draft plus `ai_generated_reason`, with Approve / Reject
- **audit timeline** `/dashboard/audit` — every `audit_logs` row, filterable by actor type,
  expandable into the `reasoning_logs` chain per order. This is the artefact judges inspect

Components come from `@workspace/ui` (base-ui + shadcn are already configured).

---

## 10. The one failure, handled gracefully

Scripted and reproducible with Razorpay test-mode failure cards:

1. Buyer approves a ₹24,999 order → Razorpay Checkout with test card `4000 0000 0000 0002`.
2. `payment.failed` webhook → existing `markPaymentFailed` → `payments.status = failed` and a
   `failures` row (`errorType: PAYMENT_DECLINED`).
3. Storefront polls `/api/payments/orders/{id}`; the agent calls `getOrderStatus` and answers:
   *"Your bank declined the payment. The order is intact and nothing was charged. You can
   retry, get a payment link to open on your phone, I can find something under ₹20,000, or
   we can cancel."*
4. Each choice is a tool call; each writes `failures.recoveryAction`
   (`RETRY_LINK_GENERATED` / `DOWNGRADED_CART` / `CANCELLED_BY_BUYER`) and an audit row.

A second failure path comes free and is worth showing: `OUT_OF_STOCK` from `priceCart` → the
agent apologises and proposes the nearest in-stock alternative.

---

## 11. Milestones

**Phase 0 — unblock**
- merchant onboarding route + `/dashboard` shell
- **connect Razorpay**: dashboard form storing `merchants.razorpayKeyId` / `razorpayKeySecret`,
  with the platform keys as fallback (`resolveMerchantCredentials` already handles both)
- `scripts/seed.ts`: one merchant, ~30 products across 5 categories, plus realistic historical
  orders so co-purchase and attach-rate maths has something to chew on
- product CRUD routes
- `embeddings.ts` + backfill; sanity-check HNSW cosine results
- `.env.example`: add the AI vars; keep `AGENT_DATABASE_URL` for the agent database

**Phase 1 — `packages/ai` skeleton**
- provider, context, guardrails, persistence, memory
- `searchProducts`, `getProduct`, `recommendProducts` only
- `/api/agent/chat` streaming + a minimal storefront chat page
- *Checkpoint: chat searches and explains recommendations; `ai_recommendations` and
  `reasoning_logs` are filling up.*

**Phase 2 — the money path, gated**
- `quoteOrder`, `createOrder`, `createPaymentLink`, `getOrderStatus`
- `toolApproval` + approval card + `addToolApprovalResponse`
- Razorpay Checkout on the storefront, verified round-trip
- *Checkpoint: a human buys something through chat, with an explicit approval step.*

**Phase 3 — merchant agent and revenue growth**
- merchant + campaign tools, dashboard chat, campaign inbox
- `suggestUpsell` reading real co-purchase data; active campaign discounts applied in `quoteOrder`
- pending agent-order approval queue
- *Checkpoint: AI drafts a bundle campaign, merchant approves, and the discount shows up in a
  buyer's quote.*

**Phase 4 — AI-to-AI commerce**
- `catalog.json`, `.well-known/agent-commerce.json`, `openapi.json`
- `scripts/ai-buyer.ts`
- API key issuance UI in the dashboard
- *Checkpoint: `bun run scripts/ai-buyer.ts` buys a product end to end with zero human input on
  the buyer side.*

**Phase 5 — audit, failure, polish**
- `/dashboard/audit` timeline + per-order trace view
- failure demo wired with all four recovery actions
- ngrok webhook setup documented; demo rehearsed

---

## 12. Demo script (~7 minutes)

1. **Merchant agent** — "How's the store doing?" → sales summary → "Sleeves attach to laptops
   at 4%. Bundle them at 15% off." → merchant approves → campaign live. *(revenue growth)*
2. **Buyer chat** — "I need headphones under ₹25,000" → recommendations with reasons and
   confidence → an upsell → **quote card** with the campaign discount broken out → **approval
   card** → Approve → Razorpay test checkout → paid. *(explainable + gated)*
3. **Failure** — repeat with the declining test card → the agent explains and offers the
   recovery options → payment link → paid. *(graceful failure)*
4. **AI buyer** — run `scripts/ai-buyer.ts`: it reads the manifest and catalog, creates an order
   with a stated reason, and stops at `pending_approval`; the merchant approves in the
   dashboard; the script picks up the payment link. *(agentic commerce)*
5. **Audit** — `/dashboard/audit`: every action above, actor-typed, with reasoning chains and
   two `failures` rows carrying their recovery actions. *(the bar)*

---

## 13. Risks and decisions

| Risk | Mitigation |
| --- | --- |
| AI SDK 7 API drift (`needsApproval` → `toolApproval`, `isStepCount`, `toUIMessageStream`) | Pin `ai` to an exact version and read the installed docs before writing agent code |
| Next.js 16 conventions differ from training data | Read `node_modules/next/dist/docs/` before writing route handlers |
| Streaming plus approval suspension is the fiddliest part of the build | Build it in Phase 2 against a single tool before adding the rest |
| pgvector quality over only ~30 products | Lexical `ILIKE` + category filter is the ranked fallback; embeddings are an enhancement, not a dependency |
| LLM inventing prices | Structurally impossible — prices only ever come from `priceCart` / `quoteOrder` |
| Webhooks need a public URL | `bunx ngrok http 3000`, already documented in `packages/payments/README.md` |
| Scope creep | Phases 0–2 are the minimum viable demo; 3–5 are additive and each independently demoable |
