# Plan — Track 01 conformance: AI Growth & Agentic Commerce

> Measured against the tree at `34cb33e` (master, clean) on 2026-09-05.
> Scope: does this project satisfy **Track 01** as written, and what is left.
>
> Verified while writing: `bun run typecheck` → exit 0. `bun run test` → 159 pass,
> 0 fail across 12 files. Nothing below is inherited from the three older plans;
> every claim carries a file reference.

---

## 0. Verdict

**The project satisfies Track 01, and it satisfies both halves of it — the
revenue agent *and* the AI-buyer path — which the brief offers as alternatives.**
The bar ("every money action explainable, bounded and gated; show the audit
trail; one failure handled gracefully") is met with room to spare: there are
three independent bounding layers, an approval gate on every money tool, a
merged human/agent audit stream with its own screen, and at least seven distinct
failure modes that are caught, logged and explained rather than thrown.

What is missing is not capability. It is **the two things that decide whether a
judge can see any of it**, plus **three seams where a claim the code makes to the
outside world is wider than what the code actually does.**

| | Count |
| --- | --- |
| Track requirements fully met | 9 of 9 |
| Blocking gaps (demo cannot be evaluated) | 1 |
| Integrity gaps (published claim ≠ shipped behaviour) | 3 |
| Depth gaps (would strengthen, not required) | 4 |

The single blocking item is that **`README.md` is still the shadcn/ui monorepo
template**. Everything this project does well is invisible to anyone who opens
the repository.

---

## 1. Scoreboard against the track statement

### 1.1 "Build an agent that grows revenue for a merchant on Razorpay test-mode APIs"

| Claim | Where | State |
| --- | --- | --- |
| Merchant agent with a real tool loop | `packages/ai/src/agents/merchant.ts` | **Done.** ~30 merchant-side tools across `tools/merchant.ts`, `tools/campaigns.ts`, `tools/pricing.ts`, `tools/readiness.ts`, `tools/payment-ops.ts`, `tools/explain.ts` |
| Direct price lever, bounded | `packages/ai/src/tools/pricing.ts:89` `updateProductPrice` | **Done.** `LIMITS.maxPriceMovePercent = 20`, `maxPriceMovesPerDay = 2` (`guardrails.ts:36-42`), history in `product_price_history` |
| Campaign orchestration with a lifecycle | `packages/db/src/schema/business.ts:307` | **Done.** `budgetPaise`, `spentPaise`, `startsAt`, `endsAt`, `status` including `paused`/`expired`. Budget is decremented on settlement (`packages/payments/src/settlement.ts:163`); expiry is enforced at quote time (`packages/ai/src/quote.ts:97-110`) |
| Campaign attribution | `apps/web/app/api/payments/orders/route.ts:85` writes `campaignId` onto the order | **Done.** `getCampaignPerformance` (`tools/campaigns.ts:367`) can answer "did it work?" |
| Margin awareness | `products.costPrice`, `checkMarginFloor` in `guardrails.ts` | **Done.** Discounts are refused below cost; uncosted products come back as `unpriced` rather than silently blocked |
| Upsell / cross-sell | `tools/shopping.ts:416` `suggestUpsell`, `tools/merchant.ts:265` `getAttachRate`, `:289` `getMissedAttachOpportunities` | **Done.** The prompt caps it at one suggestion (`agents/prompts.ts:34`) |
| Inventory and reorder | `getStockRisk`, `getReorderCandidates`, `createReorderRequest`, `listReorderRequests` | **Done**, approval-gated |
| Razorpay **test mode** | `packages/payments/src/mode.ts`, `apps/web/hooks/use-razorpay.ts` | **Done, and enforced.** A non-`rzp_test_` key is refused server-side *and* in the browser; the modal carries a "Test mode" line and a `notes` marker on the payment record |

### 1.2 "…or that makes a merchant transactable by an AI buyer end to end"

| Claim | Where | State |
| --- | --- | --- |
| Discovery handshake | `apps/web/app/.well-known/agent-commerce.json/route.ts` | **Done.** Publishes auth scheme, endpoints, capabilities, platform policy **and per-store effective policy** |
| Agent-readable catalog | `apps/web/lib/api/catalog.ts` plus two routes | **Done.** ETag'd, paginated, and it embeds the exact checkout call to make. See §3.2 for what it omits |
| Credential issuance | `POST /api/merchants/agent-keys` and `/manager/agents` | **Done.** Keys are scoped to one store and carry a per-key cap |
| Key scope enforced | `guardrails.ts` `assertKeyScope` | **Done.** A key used against another store is refused; legacy unscoped keys are grandfathered and flagged in the UI |
| Order → approval → payment → settlement | `POST /api/payments/orders` → `pending_approval` → `/approve` → `/api/payments/links` → webhook | **Done.** `createCheckoutOrder` attaches no payment instrument to an agent order |
| Reference buyer | `scripts/ai-buyer.ts` | **Done, and honest.** Zero `@workspace/*` imports, zero database access — it discovers everything over HTTP, exactly as a third party would |
| MCP surface | `packages/mcp`, `POST /api/mcp/[slug]` | **Partial.** Scope is server-decided and never taken from the caller, which is right. But all eight capabilities are read-only — see §3.1 |

### 1.3 The bar

**"Every money action explainable."**
`orders.aiPurchaseReason` is mandatory on creation and shown to the approving
merchant. `campaigns.aiGeneratedReason` carries the drafting rationale.
`tools/explain.ts` exposes `explainDecision` and `getAuditTrail` to the agent
itself. Reasoning is persisted to `reasoning_logs` (`packages/ai/src/nim-reasoning.ts`,
`persistence.ts`). **Met.**

**"Bounded."** Three layers, each catching what the others cannot:

1. `LIMITS` in `guardrails.ts:18-43` — cart shape, discount ceiling 30%, margin
   floor, price-move step and daily count.
2. `merchant_policy` via `getEffectivePolicy` (`policy.ts:52`) — per-store, and
   `stricter()` guarantees a merchant can only tighten, never loosen.
3. Per-key `spendCapPaise` at issuance, plus `assertSpendCapFor`, which is
   deliberately written once and called from *both* the in-app tool and the
   public REST route — the comment at `guardrails.ts:150-160` records that this
   was a real hole that got closed. **Met.**

**"Gated."** `agents/approval.ts` returns `user-approval` from every money tool.
Agent orders land `pending_approval` with no instrument attached. Campaigns need
activation. Reorders need approval. `AGENT_AUTO_APPROVE_CEILING_PAISE` ships at
`0`, so the bypass exists only to prove the bound is a decision rather than an
accident. **Met.**

**"Show the audit trail."** `/manager/activity` merges human actions, agent
actions and failures into one stream (`lib/data/activity.ts`) — the module
comment explains why they are deliberately *not* split into two feeds.
`GET /api/agent/trace/{orderId}` returns the full per-order record, authorised to
the buyer *or* the merchant. **Met**, with one omission noted in §3.5.

**"One failure handled gracefully."** Seven, not one:

| Failure | Caught at | Recorded as |
| --- | --- | --- |
| Spend cap breach | `assertSpendCapFor` | `BUDGET_CHECK_FAILED` + a `failures` row + an explainable message |
| Discount below cost | `checkMarginFloor` / `recordMarginBreach` | `MARGIN_FLOOR_BREACHED` |
| Key used on the wrong store | `assertKeyScope` | `MERCHANT_NOT_FOUND` |
| Off-domain web search | `checkPcSearchQuery` | `SEARCH_GUARDRAIL_BLOCKED` |
| Razorpay refusing a refund | `tools/payment-ops.ts:135` | `REFUND_FAILED` |
| Bare `{statusCode: 404}` from Razorpay | `toPaymentError` | mapped to something a merchant can act on |
| Buyer closes the checkout window | `use-razorpay.ts` `ondismiss` → `abandonPaymentAction` | order cancelled, with the server deciding whether it really was abandoned |

**Met, emphatically.**

---

## 2. What must not be rebuilt

Stated so nobody spends time here: the two-database split (`db` / `agentDb`,
separate migrations, `packages/db/README.md`), the compatibility engine
(`packages/commerce/src/compatibility/`, deterministic rules with a real
`insufficient_data` state), the payments package, better-auth with API keys, the
four verification suites (`scripts/verify*.ts`, 4,306 lines), the 159 unit tests,
and the entire Arctic Mono UI layer.

---

## 3. Gaps, ranked

### 3.0 — BLOCKING: the repository does not describe itself

`README.md` is verbatim the shadcn/ui monorepo template. It says nothing about
agentic commerce, Razorpay, the two agents, the manifest, or how to run any of
it. `docs/` holds six files and **five of them are UI-design history**, three of
those already marked superseded.

A judge cloning this repository finds no statement of what it is, no setup
sequence, no demo script, no architecture diagram, and no pointer to
`scripts/ai-buyer.ts` — which is the single most persuasive artefact in the tree.

This is the highest-leverage work remaining, by a wide margin.

### 3.1 — INTEGRITY: MCP is advertised as a door but only opens one way

`CAPABILITIES` (`packages/mcp/src/capabilities.ts:60`) holds exactly eight
entries: `products.search`, `products.get`, `products.compare`,
`build.checkCompatibility`, `build.get`, `inventory.summary`, `sales.summary`,
`orders.summary`. **Every one is read-only.**

An MCP-native buying agent can browse the store, validate a build and compare
parts — then has to drop out of MCP entirely and hand-roll REST calls to buy
anything. "Transactable end to end" is true over REST and false over MCP.

Compounding it: the discovery manifest's `endpoints` block lists `catalog`,
`create_order`, `order_status` and `payment_link`, and **does not mention
`/api/mcp/{slug}` at all**. The MCP server is undiscoverable by the very
handshake built to advertise this merchant.

### 3.2 — INTEGRITY: the agent-readable catalog omits the data that makes it readable

`toCatalogEntry` (`packages/ai/src/catalog.ts:528`) emits `attributes` — the
free-form display blob — and nothing from `product_specs`.

`product_specs` (`packages/db/src/schema/specs.ts`) is the typed, queryable table
whose own module comment states that `attributes` "is useless for validation".
Socket, form factor, TDP, PSU wattage, clearances, memory generation: all present
in the database, none of it in the document an external AI buyer reads.

The contradiction is sharpest against `packages/ai/src/readiness.ts`, which tells
the merchant *"34% of your catalogue is invisible to an AI buyer"* because those
spec columns are null — while a product with every spec filled in still exposes
none of them at `catalog.json`. And there is no public compatibility endpoint:
`build.checkCompatibility` exists over MCP and inside the in-app agent, so a REST
buyer has no way to ask whether two parts fit.

### 3.3 — INTEGRITY: merchants cannot set the bounds the manifest says are theirs

`merchant_policy` is read by `getEffectivePolicy` (`policy.ts:52`), whose comment
argues the case well: *"The money is theirs; the numbers should be too."* The
per-store block in `.well-known/agent-commerce.json` publishes those numbers to
every counterparty agent. `getPolicy` (`tools/merchant.ts:413`) reads them back
for the agent.

**Nothing writes the table.** An exhaustive grep finds `merchantPolicy` in the
schema, in `policy.ts`, and in `scripts/verify-manager.ts:768` — the test
fixture. No route, no server action, no agent tool, no screen.

So every store runs on platform defaults, the manifest's per-store block is
decoration, and `merchantConfigured` is `false` everywhere in production. The read
path is complete and correct; only the writer is absent.

### 3.4 — DEPTH: the orchestrator has no clock

`runMerchantBriefing` (`packages/ai/src/agents/briefing.ts`) is genuinely good —
unattended, audited with `scheduled: true`, and safe by construction because every
money tool suspends for an approval nobody is there to give.

But its only caller is a button. `OvernightBlock`
(`components/manager/overnight-block.tsx:41`) POSTs to the route when a human
clicks it. There is no cron, no `vercel.json`, no scheduled task anywhere in the
tree. "Overnight" describes the prompt, not when it runs. The brief names
"campaign orchestrator" as a direction; an orchestrator that only runs when
watched is an assistant.

### 3.5 — DEPTH: the per-order trace has no reader

`GET /api/agent/trace/{orderId}` returns the order, its items, its payments, the
ordered audit trail and every failure with its recovery action. It is properly
authorised to the buyer or the merchant.

Nothing calls it. The buyer's order page
(`app/store/[slug]/orders/[orderId]/page.tsx`) shows status, lines and payment
history, but not the trail. The merchant's `/manager/activity` shows a store-wide
stream, not a per-order one. The best explainability artefact in the codebase is
reachable only by typing a URL.

### 3.6 — DEPTH: no protocol alignment

The manifest declares `protocol_version: "2026-05-01"` — a bespoke shape. The
track's "why now" names UAP, ACP, AP2 and x402 specifically. Nothing in the
repository references any of them.

This is an opportunity rather than a defect: the underlying primitives (discovery
document, scoped credential, quote, gated order, status poll, settlement webhook)
map onto ACP and AP2 closely enough that a translation layer would be small. Being
the entry that speaks a named protocol is worth more than being the entry that
invented a good one.

### 3.7 — DEPTH: the verification suites are undocumented and absent from CI

4,306 lines across four suites, and `verify:manager` alone claims 57 deterministic
checks. There is no CI workflow, and no document tells a reader these exist or
what they prove. `plans/merchant-agent-plan.md` also records a known intermittent
failure in `verify:agent` scenario 2 that has not been revisited.

---

## 4. The work

Ordered by what a judge sees first.

### Phase 1 — Make the project legible (blocking; before anything else)

**1.1 Rewrite `README.md`.** Replace the shadcn template entirely. It needs:

- One paragraph: what this is, and which track.
- The two-sided claim in two sentences, each with the URL that proves it.
- Setup: `bun install` → `bun run db:up` → `bun run db:migrate` → `bun run seed`
  → `bun run embed` → `bun run dev`, with the `.env` keys that are genuinely
  required called out (the model provider key, and `RAZORPAY_KEY_ID` starting
  `rzp_test_`).
- A "see it work in 60 seconds" block: `curl` the manifest, `curl` a catalog,
  then `bun run ai-buyer`.
- An architecture diagram — the one in `plans/agentic-commerce-ai-layer.md` §2 is
  already close.

*Acceptance:* someone who has never seen the repository reaches a running store
with a seeded catalog by following the README alone, and can state what the
project does after reading only its first screen.

**1.2 Write `docs/DEMO.md`.** A timed runbook for the live demo. Suggested spine —
every beat maps to something already built:

| Beat | Shows | Surface |
| --- | --- | --- |
| 1 | Buyer converses, builds, is upsold once | `/store/{slug}/assistant` |
| 2 | Compatibility refuses a bad part with `insufficient_data`, not a guess | build surface |
| 3 | Human checkout in Razorpay test mode | checkout modal, "Test mode" line visible |
| 4 | External agent discovers the store and orders | `bun run ai-buyer` |
| 5 | Order sits `pending_approval`, nothing charged | `/manager/orders` |
| 6 | Merchant approves; payment link issued; webhook settles | `/manager/orders` → link |
| 7 | **The failure** — re-run the buyer past its cap; `BUDGET_CHECK_FAILED` | terminal and `/manager/activity` |
| 8 | The trail: one stream, human and agent, with the failure in place | `/manager/activity` |
| 9 | Merchant agent finds a discount candidate, drafts a bounded campaign | `/manager` composer |
| 10 | Margin floor refuses an over-deep discount and says why | same |

*Acceptance:* the runbook is executed end to end at least once from a clean
`bun run seed`, and every beat lands without a code change.

**1.3 Prune `docs/`.** Delete `docs/PAGE-PROMPTS.md` (it says so itself, at line
11). Move the three superseded UI documents under `docs/history/`. The top level
should be `DEMO.md`, `ARCHITECTURE.md`, `UI-UX-MEMORY.md`.

**1.4 Document the verification suites** — a short README section saying what the
four `verify*` scripts prove and which of them need a live model key.

### Phase 2 — Close the three integrity gaps

**2.1 Make the merchant's bounds writable** (`merchant_policy`).

- `PATCH /api/merchants/policy` taking the six columns, all optional,
  zod-validated, behind `assertMerchantOwner`.
- The route writes through the same `stricter()` clamp so the platform ceiling
  holds server-side, and returns the *effective* values rather than the submitted
  ones.
- Audit it. Add `POLICY_CHANGED` to `AuditAction`, with before/after in
  `metadata` — loosening `agentOrdersRequireApproval` is the most consequential
  toggle in the system and must be legible in the trail.
- A form on `/manager/account`, each field showing the platform ceiling beside the
  merchant's chosen value.
- Optionally a `setPolicy` merchant tool afterwards — but the screen first. This
  is a decision a merchant should make deliberately, not by asking a model to.

*Acceptance:* set a store's discount cap to 10, ask the agent for 25% off, watch
it clamp and say so; the per-store block in the manifest reflects the new number
on the next fetch.

**2.2 Give MCP a checkout path.** Add to `CAPABILITIES`, all at `CUSTOMER` scope,
each delegating to a tool that already exists:

- `checkout.quote` → `quoteOrder` (`tools/shopping.ts:80`)
- `orders.create` → `createOrder` (`tools/checkout.ts:118`)
- `orders.status` → `getOrderStatus` (`tools/checkout.ts:264`)
- `orders.cancel` → `cancelOrder` (`tools/checkout.ts:72`)
- `payment.link` → `createPaymentLink` (`tools/checkout.ts:235`)

No new implementations — the whole point of `capabilities.ts` is one definition
per capability, and these tools already carry the approval gate, the spend cap and
the audit write. Confirm `handleMcpRequest` propagates a suspended tool as a
legible MCP error rather than a hang.

Then **advertise it**: add `mcp: ${origin}/api/mcp/{slug}` to the manifest's
`endpoints`, with a `transport: "mcp"` note alongside the REST block.

*Acceptance:* a buying agent completes discovery → search → compatibility → quote
→ order → status entirely over MCP, and the order lands `pending_approval` exactly
as the REST path does.

**2.3 Put the specs in the catalog.** Extend `CatalogEntry` with a `specs` object
sourced from `product_specs` — the typed columns, nulls preserved as nulls (the
`insufficient_data` signal must survive the wire), plus `category_slug` and the
build slot from `product_categories`.

- Keep `attributes` for display. The two are different things and the schema
  comment already says why.
- Add per-product `readiness`, reusing `packages/ai/src/readiness.ts`, so a buying
  agent can tell a thin listing from a complete one.
- Add `POST /api/store/{slug}/compatibility` wrapping the existing engine, and
  list it in the manifest's `endpoints`. A REST buyer should be able to ask what
  an MCP buyer can ask.
- The ETag hashes `document.products`; confirm it still changes when specs change
  (it will — specs sit inside the product objects).

*Acceptance:* `scripts/ai-buyer.ts` gains a variant that assembles a compatible
two-part build from `catalog.json` and the compatibility endpoint alone, with no
`@workspace/*` import.

### Phase 3 — Depth

**3.1 Schedule the briefing.** Add `vercel.json` with a cron hitting
`/api/agent/merchant/briefing`, or a small `scripts/nightly.ts` for the local
demo. The route already expects a caller authenticated as the store owner
(`briefing/route.ts:22-27`), so the only new piece is the credential the scheduler
uses. Keep `scheduled: true` in the audit metadata — it is what makes the activity
feed's "while you were away" badge honest.

**3.2 Surface the trace.** An "Audit trail" section on the buyer's order page and
a per-order drawer in `/manager/orders`, both reading
`GET /api/agent/trace/{orderId}`. Show failure rows inline with their recovery
action; that is the part that reads as rigour. Cheap — the endpoint and its
authorisation are done.

**3.3 Protocol alignment.** Smallest useful version: keep the current manifest
shape, add a `protocols` array naming what is supported, and serve an ACP-shaped
alias of the discovery document at its conventional path. Cite the spec version in
the README. Do not restructure the working manifest for this.

**3.4 CI.** A GitHub Actions workflow running `bun run typecheck`, `bun run test`
and `bun run lint` on push. The `verify*` suites stay manual — they need a live
model and a seeded database — but say so where they are documented.

---

## 5. Sequencing

| Order | Item | Why here |
| --- | --- | --- |
| 1 | 1.1 README | Nothing else is visible without it |
| 2 | 1.2 DEMO.md | Writing it will surface any beat that does not actually work |
| 3 | 2.1 Policy writer | Smallest of the three integrity gaps, and it closes a published claim |
| 4 | 2.3 Catalog specs | Directly serves "agent-readable catalog" |
| 5 | 2.2 MCP checkout | Directly serves "transactable end to end" |
| 6 | 3.2 Trace UI | Cheap, and strengthens the bar's audit-trail requirement |
| 7 | 1.3, 1.4, 3.1, 3.4 | Housekeeping and polish |
| 8 | 3.3 Protocols | Only with time to spare |

If only one thing gets done: **Phase 1**. The project already clears the bar; it
does not yet say so.

---

## 6. Explicitly out of scope

- Rebuilding anything in §2.
- Shipping, fulfilment and tax — out of scope in the earlier plans and still are.
- Chasing `verify:agent` scenario 2's intermittent failure. It is a harness flake
  in an optional suite, documented in `plans/merchant-agent-plan.md`, and not
  worth demo time.
- Raising `AGENT_AUTO_APPROVE_CEILING_PAISE` above `0`. Its value at `0` is the
  point.
