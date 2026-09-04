# Plan — The merchant's side of the agent

> Measured against the repo on branch `feat/connect-storefront-to-data`
> (`563e1c0`), the hackathon brief ("AI Growth & Agentic Commerce"), and
> `AGENTS.md` §9–§12, as of 2026-09-04.
>
> The buyer's side is done: the storefront assistant runs the real agent, over
> the real catalog, through a gated money path. This plan is only about the
> other room — the merchant's — and about the one claim the brief makes that
> nothing in this repo currently answers from the merchant's chair: **grow the
> merchant's revenue, and make them sellable to AI buyers.**

---

## 0a. What shipped

All six milestones are implemented and committed. The table below is what the
plan asked for against what is actually in the tree.

| Milestone | State | Deviations worth knowing |
| --- | --- | --- |
| **M0** Ship the agent | Done | Also had to move the window instruction to the top of the prompt — at the foot it lost to the tool schema's own `default(30)` on one run in three |
| **M1** Stop lying | Done | `/manager` had **no authorization at all**; the own-store gate had to land first. "Mark fulfilled" was cut rather than backed by an invented column |
| **M2** Measure money | Done | Found and fixed a real hole in passing: `POST /api/payments/orders` accepted `discountAmount` from the request body, so a buying agent could order at zero |
| **M3** Sellable | Done | `enrichProduct` needed `sourcedFrom` provenance — the model invented specs across repeated runs and the gate alone was not enough |
| **M4** Levers | Done | `draftBundle` was not added as a separate tool: `draftCampaign` already takes `requiresAllProducts` and `discountType: "bundle"`, so a wrapper would be a second name for one thing |
| **M5** Orchestrate | Done | — |
| **M6** Fail well | Done | Razorpay returns a bare `{statusCode: 404}` with no description; `toPaymentError` now maps statuses to something a merchant can act on |

**Verification.** `bun run verify:manager` — 57 deterministic checks over the
writes, the bounds and the failure paths. `bun run verify:merchant` — 33 checks
against a live model, over evidence and restraint. Both green.

**Known flakiness, pre-existing and not from this work.** `verify:agent`
(the buyer suite) intermittently fails scenario 2's "quotes the cart" because
the model sometimes searches twice instead of calling `quoteOrder`. Three
harness bugs in that file *were* fixed here — Unicode look-alikes in copied
product names, a first draft refused by the new margin floor being read as a
missing projection, and a hardcoded product list that the grown catalogue had
outlived. `quoteCart` itself was confirmed correct after the `quoteForMerchant`
refactor.

**Not done, deliberately.** Feeding accepted bundles into `suggestUpsell` is
done; the storefront's own prompt was not otherwise touched. Shipping and
fulfilment remain out of scope, as §12 states.

---

## 0. The headline

There is a merchant agent. It has twenty-two tools, an approval gate, an audit
trail and a system prompt that is genuinely good. **It is not shipped.** The
merchant's live surface — `/manager` — answers questions with a regex.

Everything below ranks from that.

| # | Gap | Evidence | Blocks |
| --- | --- | --- | --- |
| 1 | The manager screen does not run the merchant agent | `apps/web/lib/data/manager-chat.ts` — four `RegExp`s and canned prose. The agent lives at `/dashboard/assistant`, reachable only from the legacy nav | The entire merchant half of the demo |
| 2 | Every merchant write is a `toast()` | `restock-screen.tsx:174,179,197`, `orders-screen.tsx:142,158`, `products-screen.tsx:79,85,99`, `store-account-screen.tsx:68,75` | Approve/reject, refund, restock, catalog edits |
| 3 | No price lever outside a campaign | No `updateProductPrice` tool anywhere | "Grow revenue" — the most direct lever is absent |
| 4 | No cost price, so no margin | `products` has `price` and nothing else | Every discount decision is revenue-blind; a 30% cap is arbitrary without it |
| 5 | Campaigns cannot be measured | `orders` has `discountAmount` but no `campaignId` | "Did the campaign work?" is unanswerable |
| 6 | Campaigns have no lifecycle | `campaigns` has no start, end, budget or pause; `status` includes `expired` and nothing ever sets it | A campaign orchestrator that cannot stop is not an orchestrator |
| 7 | No catalog-readiness capability | `productSpecs` is deliberately nullable; nothing measures coverage | "Agent-readable catalog" — the merchant cannot see why an AI buyer skipped them |
| 8 | Merchants cannot issue agent credentials | `.well-known/agent-commerce.json` says "Issue a key from the merchant dashboard". No such route, no such screen | "Transactable by an AI buyer end to end" |
| 9 | Bounds are constants, not merchant policy | `LIMITS` in `guardrails.ts`, `AGENT_AUTO_APPROVE_CEILING_PAISE` in env | "Bounded" is a developer's promise, not the merchant's |
| 10 | The agent is entirely reactive | Nothing schedules a run; `agent_tasks` exists and no merchant flow ever opens one | "Campaign orchestrator" |
| 11 | No merchant-side failure story | The graceful failure demo is all on the buyer's side | The bar: "one failure handled gracefully" |

---

## 1. What already exists — do not rebuild

| Capability | Where | State |
| --- | --- | --- |
| Merchant agent loop, streaming, reasoning, abort handling | `packages/ai/src/agents/merchant.ts` | Done and good |
| 22 merchant tools | `tools/merchant.ts`, `tools/campaigns.ts`, `tools/explain.ts` | Done |
| Approval gate for money actions | `agents/approval.ts` → `merchantApproval` | Done |
| Server-side discount clamp | `guardrails.ts` `clampDiscountPercent` | Done |
| Audit trail + failure log + reasoning chain | `audit.ts`, `agentDb` | Done |
| Analytics: sales, attach rate, slow movers, payment health, performance | `analytics.ts` | Done |
| Inventory: summary, low stock, stock risk, cancellations, order summary | `inventory.ts` | Done |
| Recommendations: reorder, discount, discontinue candidates — with stated assumptions | `recommendations.ts` | Done |
| Approve / reject agent order, end to end | `payments/orders.ts` + `/api/payments/orders/[id]/approve` | Done |
| Campaign draft → approve → applied at quote time | `tools/campaigns.ts` + `quote.ts` | Done |
| MCP with server-decided merchant scope | `packages/mcp`, `/api/mcp/[slug]` | Done |
| Razorpay connect for the merchant's own keys | `manager/razorpay-connect.tsx`, `/api/merchants/razorpay` | Done |
| `reorder_requests` table with a real status lifecycle | `db/schema/reorders.ts` | Table done, UI not wired |
| Manager summary over real store data, with its gaps named honestly | `lib/data/manager.ts` | Done |

The merchant agent is not the thing to build. **Connecting it is.**

---

## 2. Phase M0 — Hand the manager screen to the agent

This is the same move `65f31b7` made for the storefront, and it is the single
highest-value change in this plan. Until it lands, none of the twenty-two tools
run in the product a judge will actually open.

### M0.1 Replace the regex reply with the agent

- Delete `apps/web/lib/data/manager-chat.ts` and `lib/actions/manager.ts`.
- `ManagerScreen` keeps its server-rendered briefing — that part is right, the
  answer to "how is the store" should not require asking — and swaps
  `managerReplyAction` for `useMerchantAssistant`, which already exists and is
  already wired to `/api/agent/merchant`.
- `ManagerThread` renders `MerchantToolOutput` cards instead of
  `ManagerResult`. The tables it renders today become the tool-output cards for
  `getStockRisk`, `getReorderCandidates` and `getDiscountCandidates` — the same
  visual language, sourced from tool results rather than from a second query.
- The approval card (`components/assistant/cards/approval-card.tsx`) comes
  along for free, which is what puts "gated" on screen in the merchant's room.

### M0.2 Give the agent the merchant's page context

The storefront agent has `page-context.ts`; the merchant agent has nothing.
Pass the selected range and the briefing's headline figures as merchant page
context so "why is that down?" resolves without a second question.

### M0.3 Retire `/dashboard`

Six routes and eleven components duplicating `/manager` at lower fidelity.
Delete `app/dashboard/**`, `components/dashboard/**` and `dashboardRoutes`,
lifting `campaign-inbox.tsx` and `approval-queue.tsx` into the manager group
first (§3.2, §6.3) — they are the two screens `/manager` genuinely lacks.

**Done when:** typing "what should I discount this week?" into `/manager`
produces a tool-grounded answer, a draft campaign, and an approval card that
the merchant must click before a single price moves.

---

## 3. Phase M1 — Make the merchant's writes real

Every button in the manager's room currently lies. Each one below already has a
backend; the work is wiring plus an audit record.

### M1.1 Restock (`restock-screen.tsx`)

| Control | Today | Should |
| --- | --- | --- |
| Approve draft | `toast()` | `reorder_requests.status → "approved"`, audit `REORDER_APPROVED` |
| Reject draft | `toast()` | status `"rejected"` with the merchant's reason, audited |
| Threshold / suggested qty cells | local state | `updateInventoryThreshold` server action, audited |
| Create purchase order | `toast()` | `reorder_requests` rows in bulk, status `"ordered"` |

The drafts list is fed by `createReorderRequest`, which the agent already
writes. Wiring approve closes the loop the tool opens — agent proposes, human
disposes, both recorded.

### M1.2 Orders (`orders-screen.tsx`)

- **Refund** is the important one: `refundPayment` exists in
  `packages/payments/src/payments.ts` and `markPaymentRefunded` exists in
  `settlement.ts`. The button is a toast. Wire it through a confirmation, and
  make refund the merchant-side graceful failure (§8).
- **Fulfil** has no backing concept. Either add a minimal `orders.fulfilledAt`
  plus audit, or remove the control. Do not leave a button that claims a state
  the database does not hold.
- **Approve / reject agent orders** is missing from this screen entirely
  despite being the flagship flow. Lift `approval-queue.tsx` in.

### M1.3 Products (`products-screen.tsx`, `product-sheet.tsx`)

Save, duplicate and remove are toasts. Back them with a `products` write, and —
because §11 is explicit that discontinuation is a recommendation and never an
automatic deletion — make "remove" set `isActive = false`, never a delete.

Every write here goes through `recordAudit` with `actorType: "merchant"`, so
the trail shows human and agent actions in one stream.

### M1.4 Account (`store-account-screen.tsx`)

Team invite and store closure are toasts that admit they are unwired. Either
implement or cut. Cutting is fine; a screen that admits it is unwired is still
a screen that should not ship.

---

## 4. Phase M2 — The revenue tools that are missing

### M2.1 Cost price and margin (prerequisite for everything else here)

```
products.cost_price   integer, nullable, paise
```

Nullable on purpose, following the same rule as the specs: a product with no
cost has not been configured, which is a different fact from one that costs
nothing. Add:

- `getMarginSummary(merchantId, windowDays)` in `analytics.ts` — revenue, cost
  of goods, gross margin, and **how many products have no cost recorded**, so
  the agent reports coverage rather than implying the number is complete.
- A margin floor in `guardrails.ts`:
  `assertAboveMarginFloor(productId, pricePaise)`. A discount that takes a
  product below cost is refused server-side, logged as a
  `MARGIN_FLOOR_BREACHED` failure, and surfaced to the agent as an explainable
  error — the same shape as the spend cap.

Without this, "grow revenue" is measured with a metric that a 30% discount can
always improve. With it, the agent can be told to grow *margin* and be checked.

### M2.2 `updateProductPrice` — gated

The most direct revenue lever, absent today.

```ts
updateProductPrice({ productId, newPricePaise, reason })
```

- Bounded: clamped to ±`LIMITS.maxPriceMovePercent` (propose 20%) of the
  current price in one move, and hard-refused below the margin floor.
- Gated: a `merchantApproval` entry quoting the old price, the new price, the
  margin at each, and the units sold in the window.
- Explainable: writes a `product_price_history` row
  (`product_id, old_price, new_price, changed_by, actor_type, reason, created_at`)
  so "why is this ₹4,000 more than last month?" is answerable from the record.

### M2.3 Campaign attribution and lifecycle

```
orders.campaign_id      uuid, nullable, references campaigns
campaigns.starts_at     timestamp, nullable
campaigns.ends_at       timestamp, nullable
campaigns.budget_paise  integer, nullable   -- total discount it may give away
campaigns.spent_paise   integer, default 0
```

- `quote.ts` already picks the single best-matching campaign; have it return
  the campaign id, have `createCheckoutOrder` persist it, and increment
  `spent_paise` on payment capture.
- `getActiveCampaigns` gains window and budget checks: a campaign past
  `ends_at` or over `budget_paise` stops applying and flips to `expired`. That
  is what makes the budget a bound rather than a label.
- New tool `getCampaignPerformance(campaignId)` — units and revenue on
  attributed orders against the same products' baseline in the equal-length
  window before `starts_at`, with the discount actually given away and the
  margin after it. It states plainly that it cannot separate the campaign from
  seasonality, because it cannot.
- New gated tool `pauseCampaign(campaignId, reason)`. A campaign that can be
  started and not stopped is the one genuinely dangerous object in this system.

### M2.4 Payment operations for the merchant agent

`getPaymentHealth` exists but the agent cannot act on what it finds.

- `getFailedPayments(windowDays)` — failures grouped by Razorpay error code
  with the value lost, so "why is conversion down" gets a real answer.
- `refundOrder({ orderId, reason })` — gated, wrapping the existing
  `refundPayment`. `.well-known/agent-commerce.json` currently advertises
  `refund: false`; flip it only once this exists and the bound is published
  with it.
- `issuePaymentLink({ orderId, reason })` from the merchant's side — recovering
  an abandoned high-value order is upsell with the buyer already converted.

---

## 5. Phase M3 — Making the merchant sellable to AI buyers

The brief's second half. Today the *platform* is agent-ready and the *merchant*
has no controls over it at all.

### M3.1 Catalog readiness — the merchant-facing half of "agent-readable"

An AI buyer skips a product for reasons the merchant never sees: no specs, no
category, no embedding, no image, no stock signal. Make that visible.

`getCatalogReadiness(merchantId)` scores each product on what an agent needs to
retrieve, compare and trust it:

| Signal | Why an agent needs it |
| --- | --- |
| `categoryId` resolved, not just the denormalised string | Slot selection in `assembleBuild` |
| Typed `product_specs` rows for its category's required keys | Compatibility and comparison — an `insufficient_data` verdict is a lost sale |
| `embedding` present and `embedding_model` current | Semantic search finds it at all |
| `description` over a floor | Grounding for "why does this fit" |
| `imageUrl` | Human confirmation of an agent's pick |
| `inventory` row with a threshold | Stock honesty |

Returns per-product gaps and a store-level percentage, plus the one figure that
sells the feature: **revenue at risk** — the value of products an agent cannot
currently recommend.

`enrichProduct({ productId, specs, description })` — gated, writes typed
`product_specs` rows, then re-embeds. Pair it with a "Readiness" column on
`/manager/products` and a `/manager/readiness` screen.

This is the strongest new feature in the plan: unambiguously the merchant's
problem, unambiguously about AI buyers, and it produces a number that starts bad
and visibly improves during a demo.

### M3.2 Agent buyer credentials

The manifest already promises this and the app does not deliver it.

```
agent_keys  (our metadata alongside better-auth `apikey`)
  merchant_id, label, spend_cap_paise, created_at, revoked_at, last_used_at
```

- `POST /api/merchants/agent-keys` — issue a key scoped to this merchant, with
  a per-key spend cap. `DELETE` revokes.
- `/manager/agents` — issued keys, what each has bought, its cap and spend
  against it, revoke. This is the merchant looking their AI customers in the eye.
- `guardrails.ts` `assertWithinSpendCap` currently reads a global
  `spendCapPaise()`. Make it prefer the key's own cap when the actor is an
  API-key agent. The bound becomes per-counterparty rather than per-deployment.
- New merchant tool `getAgentBuyerActivity(windowDays)` — orders by agent buyer,
  approval rate, rejection reasons. A merchant should be able to ask "which
  buying agents are worth keeping?"

### M3.3 Merchant-owned policy

Move the bounds out of constants and into a row the merchant controls.

```
merchant_policy  merchant_id,
                 max_discount_percent           (default 30, platform ceiling 50)
                 auto_approve_ceiling_paise     (default 0)
                 max_price_move_percent         (default 20)
                 margin_floor_percent           (default 0)
                 agent_orders_require_approval  (default true)
```

`LIMITS` becomes the platform ceiling; the merchant's row is what actually
applies, and can only be stricter. Surface it on `/manager/account` as plain
sentences, and publish the effective values in
`.well-known/agent-commerce.json` — a counterparty agent then reads this
store's real bounds rather than the platform's defaults.

New tool `getPolicy()` (read-only, ungated) so the agent answers "what are you
allowed to do?" from the record instead of from its prompt.

---

## 6. Phase M4 — The campaign orchestrator

With M2.3 and M3.3 in place this is small, and it is the brief's named example
direction.

### M4.1 A merchant task, opened and closed

`agent_tasks` exists and no merchant flow opens one. A campaign is exactly the
object it was designed for: intent → outcome. Open a task on `draftCampaign`,
close it `resolved` when the campaign completes above its projection and
`failed` when below, with the measured detail. That makes §24's question — did
the agent actually help — answerable on the merchant side too.

### M4.2 The scheduled run

A single endpoint, `POST /api/agent/merchant/briefing`, that runs the merchant
agent unattended against a fixed prompt: pull the numbers, find the two things
that changed, draft at most one campaign and at most one reorder request, write
the result as a stored briefing.

The bounds that make unattended safe all already exist:

- The scheduled actor cannot approve anything. `merchantApproval` returns
  `user-approval` for every mutation and there is no human in the loop, so those
  tools simply do not run. Nothing it produces is live.
- Drafts only. `draftCampaign` and `createReorderRequest` create
  `pending_approval` / `draft` rows by construction.
- The whole run is audited under `actorType: "ai_assistant"` with a
  `scheduled: true` metadata flag, so the merchant can tell what happened while
  they were asleep from what they asked for.

Surfaced as "While you were away" at the top of `/manager`, above the briefing,
with the drafts inline and approve/dismiss on each.

### M4.3 Campaign lifecycle in one place

`/manager/campaigns`: drafts awaiting approval, active with spend against budget
and days remaining, finished with measured performance. Approve, pause and
activate all from here, all gated, all audited.

---

## 7. Phase M5 — Cross-sell and upsell, from the merchant's side

`getAttachRate` and `getFrequentlyBoughtWith` exist and only the buyer's agent
uses them. The merchant should be able to act on them.

- `draftBundle` — a first-class wrapper over `draftCampaign` with
  `requiresAllProducts: true`, seeded from a measured attach rate, projecting
  from the actual co-purchase base rather than a flat uplift factor.
- `getMissedAttachOpportunities(windowDays)` — orders that contained the anchor
  and *not* the attachment, with the revenue that represents. That is the
  cross-sell number a merchant will act on, and it is one query away from what
  `getAttachRates` already computes.
- Feed approved bundles back to the storefront agent's `suggestUpsell`, so an
  approved bundle is what the buyer's agent offers. The two agents currently
  share a database and no strategy; this is the cheapest place to connect them.

---

## 8. Phase M6 — The merchant-side failure, handled gracefully

The bar asks for one failure handled gracefully, and the current one is on the
buyer's side. Add its mirror, because the merchant's failures are the ones that
lose money quietly.

**Chosen failure: a refund Razorpay rejects.** It is real, it is reachable in
test mode (refunding above the captured value, or a payment not yet captured),
and it is the merchant's most anxious moment.

The handled path:

1. `refundOrder` calls Razorpay and gets a rejection.
2. The error is mapped through `toPaymentError`, written to `failures` with the
   Razorpay error code, and written to `audit_logs` as `REFUND_FAILED` with the
   merchant's stated reason attached.
3. The order and payment rows are **not** moved. The refund did not happen, so
   nothing pretends it did.
4. The agent tells the merchant exactly what Razorpay said, that no money moved,
   what the payment's actual state is (from `getPaymentStatus`, not from the
   agent's recollection), and the two things they can do — capture first then
   refund, or refund the correct amount.
5. `explainDecision` on that order reads the whole sequence back from the trail.

**Second, cheaper failure worth having:** activating a campaign that overlaps an
active one on the same products. `quote.ts` already picks the single best
campaign, so discounts do not stack — but the merchant does not know that.
`activateCampaign` should detect the overlap, name the campaign it will lose to
or supersede, and make the merchant confirm against that fact.

---

## 9. Observability additions

- Merchant tool calls already record via
  `toolCallRecorder({ agentType: "admin" })`. Add a `/manager/activity` screen
  over `audit_logs` — a merchant-readable ledger of every agent and human action
  on the store, filterable by actor type. This is the audit trail the brief asks
  to be *shown*, and it is one query over a table that is already populated.
- Extend `scripts/verify-agent.ts` with merchant scenarios: the discount clamp,
  the margin floor, the per-key spend cap, the refund failure, the campaign
  overlap. Each asserts the refusal *and* the audit row.

---

## 10. Sequencing

| Milestone | Contents | Why here |
| --- | --- | --- |
| **M0 — Ship the agent** (§2) | Manager screen runs the merchant agent; `/dashboard` retired | Twenty-two tools go from written to shipped. Nothing else matters more |
| **M1 — Stop lying** (§3) | Restock, orders and product writes real and audited | A demo where the merchant clicks approve and something happens |
| **M2 — Measure money** (§4.1, §4.3) | Cost price, margin, campaign attribution, budget, pause | Makes "grew revenue" checkable and makes campaigns stoppable |
| **M3 — Sellable** (§5.1, §5.2) | Catalog readiness, agent keys, per-key caps | The brief's second half, and the best new feature |
| **M4 — Levers** (§4.2, §4.4, §7) | Price tool, refunds, bundles, missed attach | Direct revenue actions, all gated |
| **M5 — Orchestrate** (§6, §5.3) | Scheduled briefing, campaign screen, merchant policy | The named example direction, safe because M2 bounded it |
| **M6 — Fail well** (§8, §9) | Refund failure, overlap warning, activity ledger, verify script | The bar's explicit ask |

M0 and M1 are the demo. M2 and M3 are the substance. M4–M6 are what make it look
designed rather than assembled.

---

## 11. Demo script — the merchant half (~4 minutes)

1. Open `/manager`. The briefing is already there: revenue, what is selling,
   what is stuck, orders due. Nobody has asked a question yet.
2. **"While you were away"** — the overnight run drafted one campaign and one
   reorder request. Neither is live. Show the audit entry that says so.
3. Ask **"why is conversion down this week?"** → `getCancellationSummary` and
   `getFailedPayments` answer with grouped Razorpay error codes and the value
   lost. Not a guess.
4. Ask **"what should I discount?"** → `getDiscountCandidates` returns capital
   tied up per product; the agent drafts a campaign, cites the tool and window
   in `basedOn`, projects the impact with its assumptions on the label, and
   proposes 45% — which comes back clamped to 30%, with the clamp stated.
5. Approve it. The approval card appears; nothing moved until the click. Show
   the audit row.
6. **Catalog readiness**: 34% of the catalog is invisible to an AI buyer, worth
   ₹X. Run `enrichProduct` on one. The score moves.
7. **Agent keys**: issue a key with a ₹50,000 cap. Run `scripts/ai-buyer.ts`
   against it. The order lands in the approval queue with its stated reason.
   Approve one; reject one with a reason.
8. **The failure**: refund an uncaptured payment. Razorpay refuses. The agent
   says what happened, that no money moved, and what to do next.
   `explainDecision` reads the whole thing back from the trail.
9. Ask **"did that campaign work?"** → measured against the equal window before
   it, with the discount given away and the margin after it, and an honest note
   that it cannot separate the campaign from seasonality.

---

## 12. Risks and decisions

**The two merchant UIs.** `/dashboard` and `/manager` both exist and only one is
in the nav. Retiring `/dashboard` (§2.3) is a decision, not a cleanup — its
campaign inbox and approval queue are real work that must be lifted first. Doing
M0 without M0.3 leaves two merchant surfaces disagreeing, which is worse than
either alone.

**Cost price is a data problem, not a code problem.** The margin work is
worthless unless the seed carries plausible costs. `scripts/data` needs a cost
per product before §4.1 means anything, and the tools must report coverage
rather than assume it — the same discipline the specs already follow.

**The scheduled run is the only unattended agent in the system.** Its safety
rests entirely on the fact that gated tools cannot execute without a human
approval response. That should be asserted by a test in
`scripts/verify-agent.ts`, not assumed from reading `approval.ts`.

**Attribution is weak and should say so.** A before/after window is not a
control group. `getCampaignPerformance` must state that limitation in its own
output, the way `getStockRisk` states its projection assumptions, or the
merchant will read a coincidence as a result.

**`updateProductPrice` is the riskiest tool in the repo.** It moves money on
every future order rather than one, it is easy for a model to reach for, and a
clamp on the per-move percentage does not stop repeated moves. Consider a daily
budget on price movement per product before shipping it, or hold it behind a
merchant-policy flag defaulting to off.

**Out of scope here:** shipping and fulfilment (the schema holds no shipment,
and inventing one to make a "fulfil" button work is the wrong trade),
multi-user merchant teams beyond what `store-account-screen` already sketches,
and any change to the buyer-side agent except §7's bundle feedback.
