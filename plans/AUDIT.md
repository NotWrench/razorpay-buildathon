# Codebase audit — Alfred (razorpay-buildathon)

**Date:** 2026-09-05
**Commit audited:** `9db9806` (master; working tree clean apart from untracked `plans/`)
**Predecessor:** `plans/OLD_AUDIT.md`, audited at `089b47a` — twelve commits behind this one
**Scope:** everything the old audit covered (dead code · unwanted things · security · "filtering and sorting belong in the DB" · agent-DB usage), plus the **buyer-mandate / unattended-payment feature** that landed since, which is new money-moving surface and gets a section of its own.
**Method:** static read of all 674 tracked files, plus two things actually run — `bun run test` (288 pass, 0 fail, 4 packages) and `bun run lint` (195 errors, advisory). Nothing was run against a live database and no dynamic testing was performed. Every finding cites a file and line.

---

## 0. Executive summary

Between `089b47a` and `9db9806` the project shipped one substantial feature — a buyer mandate: a standing, bounded, revocable authorisation that lets an agent settle an order with nobody watching. It is the best-reasoned code in the repository. The rule is pure and separately tested (`packages/payments/test/mandate-policy.test.ts`), the bound is checked before the gateway is touched, refusals carry distinct codes, the delegation and every use of it are audited, revocation is a timestamp rather than a delete, and the simulated instrument is labelled on the mandate row, in the audit entry and in the API response. `packages/payments` also gained its first tests — 22 of them.

**Nothing from the previous audit was fixed.** All 19 security findings, all 11 filtering findings, all five dead files, the missing migration snapshot, the two parallel storefronts and the seven undocumented environment variables are still exactly as reported. That is not a criticism of the sequencing — feature work continued and the audit was advisory — but it means this report is mostly the old one plus a new surface, and the old backlog is now the older backlog.

The new surface brings four findings of its own. Two are serious:

| # | Finding | Where | Severity |
|---|---|---|---|
| **N1** | **Any caller can mint a `simulated` mandate and mark real orders `paid` without money moving** — drawing down stock and settling the order in the same states a gateway payment produces | `apps/web/app/api/payments/mandates/route.ts:64`, `packages/payments/src/mandates.ts:131` | **High** |
| **N2** | A **cancelled (abandoned) order can still be charged** — `chargeMandate` checks `approvalStatus`, and `abandonCheckout` does not clear it | `packages/payments/src/mandates.ts:173`, `orders.ts:475` | **High** |
| **N3** | The mandate's lifetime cap is **check-then-act**; concurrent charges can both pass it | `packages/payments/src/mandates.ts:186-212` | Medium |
| **N4** | `razorpayTokenId` / `razorpayCustomerId` are **accepted from the request body unverified** | `apps/web/app/api/payments/mandates/route.ts:29-30` | Medium |

Carried forward unchanged from the old audit, still the three that matter most:

| # | Finding | Where | Severity |
|---|---|---|---|
| C1 | Merchant Razorpay **key secrets stored in plaintext** | `packages/db/src/schema/business.ts:23-27` | High |
| C2 | `emailAndPassword` sign-up open, no verification, no rate limit; `user.role` client-settable | `packages/auth/src/index.ts:63,84` | High |
| C3 | Payment-link callback **redirects every payer to a 404** | `apps/web/app/api/payments/links/callback/route.ts:29,49,57` | High |

By category:

| Area | Status since `089b47a` | Headline |
|---|---|---|
| New feature (mandates) | New | Well-built; four findings, two of them High |
| Dead code | Unchanged | 5 dead files, 14 of 40 UI components unused |
| Unwanted / duplicated | Unchanged | Two complete storefronts still live |
| Security (old) | Unchanged | 4 high, 6 medium, 7 low; still no rate limiting anywhere |
| DB filtering / sorting | Unchanged | All 11 sites; `/shop` still loads the entire catalogue into JS |
| Agent DB | Improved slightly | Separation still clean; `hasDedicatedAgentDatabase` is now consumed by `scripts/verify.ts:82` |
| Tests | Improved | `packages/payments` went from zero tests to 22; `signature.ts` and `settlement.ts` still untested |

---

## A. The mandate feature — new findings

### What is right, first

These are load-bearing and should not be disturbed:

- **The rule is pure and has no clock of its own.** `checkMandate` (`packages/payments/src/mandate-policy.ts:72`) takes `now` as a parameter and returns a decision; the database and the audit writes live in `assertMandateCovers` around it. That is why the expiry and cap boundaries can be — and are — tested exhaustively.
- **Refusals are distinct.** `MANDATE_EXHAUSTED`, `MANDATE_EXPIRED`, `MANDATE_OVER_PER_ORDER_CAP`, `MANDATE_REVOKED`, `MANDATE_WRONG_STORE` (`mandate-policy.ts:36-41`). Contrast **B3** below, where five unrelated guardrail violations all return `EMPTY_CART`. The new code did not repeat the old mistake.
- **`findMandate` deliberately returns revoked and expired rows** so `checkMandate` can give the true reason rather than the blander "you have no authorisation here" (`mandate-policy.ts:134-146`). The reasoning is written down and correct.
- **The instrument is derived, never accepted.** `establishMandate` (`mandates.ts:284`) sets `recurring` only when a token *and* a customer id are present, so a tokenless mandate cannot be labelled chargeable and fail at the moment money is meant to move.
- **Revocation is authorised at the route.** `apps/web/app/api/payments/mandates/[mandateId]/revoke/route.ts:45` checks `mandate.buyerIdentifier !== actor.identifier` and does not distinguish "not found" from "not yours".
- **The pay route trusts only the order id.** `apps/web/app/api/payments/pay/route.ts:48` re-checks buyer ownership; the amount comes off the order row (`mandate.ts:46`), never from the model or the caller.
- **The approval gate and the pay tool ask the same question in the same place.** `mandateCoverage` (`packages/ai/src/mandate.ts:35`) is called from both `agents/approval.ts:95` and `tools/checkout.ts:278`, and uses `checkMandate` rather than `assertMandateCovers` so merely *looking* does not write a refusal to the failure log.
- **The bounds are published, not merely enforced** — `/.well-known/agent-commerce.json` carries a `mandates` block with the establish call, the refusal codes, the revocation guarantee and an explicit `settlement_note` about simulation.

### N1 — A self-issued simulated mandate marks orders paid without money moving · **HIGH**

Three facts compose into this:

1. `POST /api/payments/mandates` (`apps/web/app/api/payments/mandates/route.ts:64`) accepts **any** actor `resolveActor` returns — a signed-in user, an **API-key agent**, or an anonymous **guest cookie** (`apps/web/lib/api/actor.ts:88`). There is no check that the principal is a person.
2. A mandate created without a Razorpay token is `simulated` (`mandates.ts:284`), and `simulatedInstrument.charge` (`mandates.ts:131`) returns a `sim_…` identifier **without calling any gateway**.
3. `chargeMandate` then calls `markPaymentCaptured` (`mandates.ts:202`) on exactly the same path a real payment takes: `payments.status = 'captured'`, `orders.orderStatus = 'paid'`, and `drawDownStock` runs (`settlement.ts:198-200`).

So a visitor who has done nothing but load the storefront — the proxy hands out a guest cookie automatically (`apps/web/proxy.ts:42`) — can:

```
POST /api/payments/mandates   { slug, maxPerOrderPaise: 50000000, maxTotalPaise: 50000000, days: 365 }
POST /api/payments/pay        { orderId }
```

and settle an approved order for ₹5,00,000 with no money moving. The merchant's order list shows `paid`. Stock is decremented. The simulation *is* labelled — in the audit explanation (`mandates.ts:224`), in the API response's `simulated: true` (`pay/route.ts:96`) and on the mandate row — but it is **not** labelled in the two places that drive behaviour: `orders.orderStatus` and `payments.status`. Anything reading order state to decide whether to ship reads "paid".

The mitigation the code relies on is honesty of reporting, and that is genuinely well done. What is missing is a gate on *reachability*. Two things are needed and neither is large:

- **Gate the simulated instrument on the environment**, the way `assertTestMode` (`packages/payments/src/mode.ts:41`) already gates live keys. A `MANDATE_ALLOW_SIMULATED` that defaults off, refused in production, would keep the demo path working and close this.
- **Carry the label into the state machine.** A `payments.simulated boolean` column, or an `orderStatus` of `paid_simulated`, so a merchant screen and a fulfilment step cannot mistake one for the other. Today the distinction lives only in prose.

Independently, the endpoint should decide whether an `ai_agent` actor may author a mandate at all. The feature's own argument (`packages/db/src/schema/business.ts:376-380`) is that the gate *moved* to the moment of delegation, "where the person deciding has time to read the numbers" — but if the delegate can write its own delegation, no person read anything. `route.ts:84` already contemplates a non-human actor; that branch is where the refusal belongs.

### N2 — A cancelled order can still be paid from a mandate · **HIGH**

`chargeMandate` guards on two states (`mandates.ts:173-182`):

```ts
if (order.approvalStatus !== "approved") throw …ORDER_NOT_APPROVED
if (order.orderStatus === "paid")        throw …ORDER_ALREADY_PAID
```

`rejectOrder` sets **both** `approvalStatus: "rejected"` and `orderStatus: "cancelled"` (`orders.ts:409`), so a rejected order is correctly refused. But `abandonCheckout` sets **only** `orderStatus: "cancelled"` (`orders.ts:475-478`) and leaves `approvalStatus` on `approved`.

So a buyer who opened checkout, closed the window, had the order cancelled — and who has a live mandate — can have that cancelled order charged and reopened: `markPaymentCaptured` unconditionally writes `orderStatus: "paid"` (`settlement.ts:194`) and draws down stock, because `context.order.orderStatus !== "paid"` is true for a cancelled order.

The same gap reaches `verifyCheckoutPayment` (`packages/payments/src/payments.ts:72`) and the `payment.captured` webhook (`webhooks.ts:78`), neither of which checks for `cancelled` either.

**Fix:** refuse `orderStatus === "cancelled"` in `chargeMandate`, and — better, because it covers all three entry points — in `markPaymentCaptured` itself.

### N3 — The lifetime cap is check-then-act · Medium

`chargeMandate` reads the mandate, checks the bound, charges, and *then* advances `spentPaise` (`mandates.ts:186-212`). The comment at `mandates.ts:163-165` defends this:

> The headroom is advanced with a relative update rather than a read and a write, so two charges settling at the same instant both count

That is true of the **increment** and it is the right way to write it. It is not true of the **check**, which ran against a `spentPaise` read before either charge started. Two `POST /api/payments/pay` calls for two different orders, issued concurrently, both pass `assertMandateCovers` against the same stale total, both settle, and the mandate ends up over `maxTotalPaise`. The bound the buyer set is the one thing this feature promises, so this is worth closing even though it needs a race to hit.

**Fix:** make the increment the check — a conditional update that both advances and enforces in one statement, and treat "no row updated" as the refusal:

```sql
UPDATE buyer_mandates
   SET spent_paise = spent_paise + $amount
 WHERE id = $id AND spent_paise + $amount <= max_total_paise
```

Reserve before the gateway call and release on failure, or accept the ordering as-is and use `SELECT … FOR UPDATE` inside a transaction spanning the check and the increment. The former is closer to what the current comment already argues for.

### N4 — Payment tokens are accepted from the request body unverified · Medium

`apps/web/app/api/payments/mandates/route.ts:29-30` takes `razorpayTokenId` and `razorpayCustomerId` as free strings and passes them into `establishMandate`, which stores them and marks the mandate `recurring`. Nothing checks that the token belongs to the caller or that it exists at Razorpay.

A caller who obtains another person's `token_…` / `cust_…` pair — they travel through a browser checkout and appear in client-side handlers — can establish a mandate on their own `buyerIdentifier` backed by someone else's payment instrument, and then charge it through `/api/payments/pay` for their own orders.

The route's own comment is careful about exactly the adjacent risk — "It is never taken from the body: a caller who could name the buyer could authorise spending on somebody else" (`route.ts:79-81`) — and that reasoning applies one field over.

**Fix:** fetch the token from Razorpay and assert `token.customer_id === body.razorpayCustomerId` and that the customer's contact/email match the mandate's, or issue the token server-side from a checkout this route initiates rather than accepting one.

### N5 — The last mile is REST-only · Low

`/.well-known/agent-commerce.json:80-82` publishes `mandates` and `pay` endpoints and advertises both `rest` and `mcp` transports with the claim that "an MCP caller reaches the same tools the in-app agent calls" (route.ts:85-91). `payForOrder` is **not** in `packages/mcp/src/capabilities.ts`. An MCP-native buying agent reading that manifest will discover the unattended path exists and find no capability for it. Either add the capability or scope the transport note.

---

## B. Previously reported, verified still open

Each was re-checked at `9db9806`. Line numbers below are current.

### Security — high

| Old ref | Finding | Current location | Verified |
|---|---|---|---|
| **C1** | `razorpay_key_secret` / `razorpay_access_token` / `razorpay_refresh_token` are plain `text` | `packages/db/src/schema/business.ts:23,26,27` | Unchanged |
| **C2** | `emailAndPassword: { enabled: true }` with no UI, no `requireEmailVerification`, no rate limit; `role` has `input: true` | `packages/auth/src/index.ts:63,84` | Unchanged |
| **C3** | Callback redirects to `/checkout/success` and `/checkout/failed`; neither route exists — the only checkout route is `app/(store)/checkout/page.tsx` | `apps/web/app/api/payments/links/callback/route.ts:29,49,57` | Unchanged. Confirmed by search: those paths appear in the codebase **only** as the three redirect targets |
| **C4** | `DELETE /api/merchants/razorpay` clears `razorpayKeyId`/`razorpayKeySecret` but not the three OAuth columns, and `resolveMerchantCredentials` checks `razorpayAccessToken` **first** | `packages/payments/src/client.ts:46`; `apps/web/app/api/merchants/razorpay/route.ts:127` | Unchanged |

### Security — medium

| Old ref | Finding | Verified |
|---|---|---|
| **C5** | Webhook signatures only ever checked against the platform secret; no `merchants.razorpay_webhook_secret` column exists for connected accounts (`packages/payments/src/webhooks.ts:156`) | Unchanged |
| **C6** | `markPaymentCaptured` writes `input.amount` and sets `paid` **without comparing to `order.totalAmount`** (`packages/payments/src/settlement.ts:183,194`). Still reachable from `POST /api/payments/capture` (partial `amount` accepted, `capture/route.ts:13`), `verifyCheckoutPayment` (`payments.ts:73`) and the webhook. `verifyCheckoutPayment` still does not assert `remote.order_id` matches, and still branches only on `status === "failed"` (`payments.ts:64`) — an authorized-but-uncaptured payment is recorded as captured | Unchanged |
| **C7** | `MANAGER_DEV_OPEN` hands the default store to any signed-in user who owns none (`apps/web/lib/manager-store.ts:54`), still absent from `.env.example`, still not gated on `NODE_ENV` | Unchanged |
| **C8** | **No rate limiting anywhere.** A full-text search for `rateLimit`/`ratelimit` across `apps` and `packages` returns only better-auth's own API-key columns (`packages/db/src/schema/auth.ts:179-181`), Razorpay's 429 message and four comments. `/api/agent/chat` and `/api/agent/merchant` still carry `maxDuration = 180` per unauthenticated call | Unchanged — **and now worse**, because `/api/payments/mandates` and `/api/payments/pay` are two more unauthenticated-reachable money endpoints |
| **C9** | `callbackUrl: z.url().optional()` passed straight to Razorpay as the post-payment redirect (`apps/web/app/api/payments/links/route.ts:13`) | Unchanged |
| **C10** | Firecrawl `title`/`snippet`/`url` reach the model unlabelled and undelimited while the same turn holds money tools (`packages/ai/src/tools/web-search.ts:73-80`) | Unchanged |

### Security — low

| Old ref | Finding | Verified |
|---|---|---|
| **C11** | `FIRECRAWL_API_KEY` undocumented | Unchanged |
| **C12** | Guest cookie sets `httpOnly`, `sameSite`, `path`, `maxAge` but **not `secure`** (`apps/web/lib/store/buyer.ts:72-76`, `apps/web/proxy.ts:46`) | Unchanged |
| **C13** | `AGENT_APPROVAL_SECRET ?? RAZORPAY_KEY_SECRET` — one secret, two unrelated cryptographic purposes (`packages/ai/src/provider.ts:433`) | Unchanged |
| **C14** | `activity.ts`'s comment claims order ids are "checked against this merchant's own orders"; the query has no `eq(orders.merchantId, …)` (`apps/web/lib/data/activity.ts:71-79`) | Unchanged |
| **C15** | `approveOrder` checks only `orderStatus === "paid"` (`packages/payments/src/orders.ts:365`) — a rejected, cancelled order can still be approved, creating a live Razorpay order for it | Unchanged |
| **C16** | Stock validated at order time, decremented at capture, clamped with `GREATEST(stock - qty, 0)` — overselling fails silently | Unchanged |
| **C17** | LIKE wildcards unescaped (`packages/ai/src/catalog.ts:341,356`, `apps/web/lib/queries/catalog.ts:131`, `apps/web/lib/data/catalog.ts:138-140`, `lib/data/product.ts:346-348`) | Unchanged |
| **C18** | `createApiKey` called with no `expiresIn` and no per-key `rateLimit` (`apps/web/lib/api/agent-keys.ts:131-141`) | Unchanged |
| **C19** | `.well-known/agent-commerce.json` enumerates **every** merchant with no limit, then `Promise.all(getEffectivePolicy)` per store (`route.ts:25-31,193-195`) | Partly improved — the select is now an explicit four-column projection rather than `db.select()`, so no `embedding` travels. Still unbounded, still N+1 |

### Structure and hygiene

| Old ref | Finding | Verified |
|---|---|---|
| **B1** | **Two complete storefronts.** `app/(store)/*` (JS filtering, `lib/data/*`) and `app/store/[slug]/*` (SQL filtering, `lib/queries/*`) both live and routable. Duplicate basenames still present: `assistant-dock.tsx`, `order-trail.tsx`, `pending-labels.ts`, `product-card.tsx`, `tool-output.tsx` | Unchanged |
| **B2** | `/preview` — the internal build-review hub — still publicly routable with no guard (`apps/web/app/(store)/preview/page.tsx`, `primitives.tsx`) | Unchanged |
| **B3** | `violation()` returns `EMPTY_CART` for cart-shape, quantity, **spend-cap**, **margin-floor** and **web-search** violations alike (`packages/ai/src/guardrails.ts:47`), and `PaymentError.code` is the public HTTP contract | Unchanged. The mandate work shows the right pattern one directory over |
| **B4** | Seven env vars read by code and absent from `.env.example` — re-derived mechanically at this commit, still exactly seven: `AGENT_VERIFY_PACE_MS`, `FIRECRAWL_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `MANAGER_DEV_OPEN`, `NVIDIA_BASE_URL`, `OLLAMA_API_KEY`, `OLLAMA_BASE_URL` | Unchanged |
| **B5** | `packages/db/drizzle/meta/0013_snapshot.json` still missing. The chain now runs `0000`–`0012`, `0014`–`0017` — **two more migrations have been generated across the gap** since the last audit, so whatever `db:generate` computed for `0016` and `0017` did so over a broken chain | Unchanged, and more urgent |
| **B6** | `packages/db/README.md` drift, all three items still true: it says the agent database holds **seven** tables (there are **eleven**), lists **five** writer modules (there are **eight**), and describes project migrations as `0000`–`0002` (there are **eighteen**) | Unchanged |
| **A5** | `/api/agent/chat` and `/api/agent/merchant` still tell operators to "Set OPENAI_API_KEY or AI_GATEWAY_API_KEY"; neither variable exists in this project | Unchanged |

### Dead code — re-verified by reference search

| Old ref | File | Verified |
|---|---|---|
| **A1** | `apps/web/lib/queries/admin.ts` — `listMerchantOrders` has **zero** references outside its own file | Still dead. Also still contains **D3** (filter applied after `limit`) |
| | `apps/web/components/assistant/merchant/merchant-assistant.tsx` — `MerchantAssistant` never imported | Still dead |
| | `apps/web/components/chat/use-word-stream.ts` — `useWordStream` never imported | Still dead |
| | `apps/web/components/common/stat-tile.tsx` — `StatTile` never imported | Still dead |
| | `scripts/tmp-readiness.ts` | Still present |
| **A2** | Unused UI components: now **14** of 40, not 15 — `toggle.tsx` is imported by `toggle-group.tsx:5`, which is itself unused, so it is a dead pair rather than a live component. Current list: `accordion` `alert` `avatar` `empty` `progress` `scroll-area` `separator` `skeleton` `spinner` `table` `tabs` `textarea` `toggle`+`toggle-group` `tooltip`. The hand-rolled replacements are all still there: `manager/table-skeleton.tsx`, `manager/manager-table.tsx`, `common/empty-state.tsx` | Unchanged |
| **A3** | The three OAuth columns are still written by nothing, so the first branch of `resolveMerchantCredentials` (`client.ts:46`) is still unreachable | Unchanged |
| **A4** | `user.role` is still read for no authorisation decision anywhere; every merchant check goes through `isMerchantOwner` or `requireManagerStore` | Unchanged |

---

## C. Filtering and sorting in the database

All eleven sites are unchanged. Restated compactly, because the reference implementation the old audit pointed at — `apps/web/lib/queries/catalog.ts`, which filters, sorts, pages and counts entirely in SQL — is still sitting in the same repository as every one of these.

| Old ref | Site | What is still in JavaScript |
|---|---|---|
| **D1** ⚠️ | `apps/web/lib/data/catalog.ts:121-249` (`getCatalog`, powers `/shop`) | Stock filter (`:183`), price bounds, brand filter, price sort (`:95-99`), paging (`:224`, `sorted.slice(0, take)`), total count. Still no `.limit()`/`.offset()`, still selects the whole `products` row **including `embedding vector(1536)`** (`schema/business.ts:76`), still called from `/shop` with no category — i.e. the entire active catalogue per request |
| **D2** | `apps/web/lib/api/agent-keys.ts:54-57` | `db.select().from(apikey)` — **every API key of every merchant** — then `.filter(row => metadataOf(row).merchantId === merchantId)`. Cross-tenant rows transit a process with no business seeing them. Then a second in-memory layer: per-key `activity.filter(...)` and `countFor(status)` re-scanning the same array three times per key |
| **D3** | `apps/web/lib/queries/admin.ts:23-33` | `.limit()` applied **before** the status filter — `listMerchantOrders({status:"paid", limit:50})` returns whichever of the 50 newest orders are paid, possibly none. Module is dead; delete rather than fix |
| **D4** | `packages/ai/src/analytics.ts:111,165,355,431` | `getProductPerformance` (every active product, then JS sort), `getSlowMovers`, `getMissedAttachOpportunities` (filters *after* the top-40 cut, so asking for 10 can return fewer), `getAgentBuyerActivity` (re-folds SQL groups with a `Map`) |
| **D5** | `packages/ai/src/inventory.ts:101-130` | `getLowStockProducts` — directly expressible predicate, called from the dashboard *and* the nightly briefing *and* the restock screen |
| **D6** | `apps/web/lib/data/manager.ts:261,265,418,445` | Four `.slice(0, 3)` / `.slice(0, 2)` blocks rendering three rows each, all fed by the unbounded scan in D4 |
| **D7** | `apps/web/lib/data/manager.ts:463-478` | `getManagerProducts` — every product, all columns (`embedding` again), no pagination |
| **D8** | `apps/web/lib/data/account.ts:83,134,141` | A shopper's entire order history loaded to compute `sum(total_amount) where paid` and `min(created_at)` |
| **D9** | `apps/web/app/api/products/route.ts:41-55`, `campaigns/route.ts:36-40` | Unbounded; `/api/campaigns` still uses bare `db.select()` |
| **D10** | `packages/ai/src/quote.ts:71-116` | Window and budget predicates filtered in memory |
| **D11** | `apps/web/lib/data/conversations.ts:158-162` | Role filter and empty-content drop after fetching every message |

**Indexes.** Coverage is still good where it exists. The two gaps the old audit named are still open and are still the ones that bite once the above are pushed down:

- no composite `(merchant_id, created_at)` on `orders` — the shape of nearly every manager query;
- nothing reaching `apikey.metadata->>'merchantId'` (**D2**).

Add a third, from the new feature: `buyer_mandates` indexes `buyerIdentifier` and `merchantId` separately (`schema/business.ts:448-449`), but every lookup — `findMandate`, `findLiveMandate` — filters on **both** and orders by `createdAt` (`mandate-policy.ts:151-157,167-174`). A composite `(buyer_identifier, merchant_id, created_at desc)` is the query's actual shape.

---

## D. The second Postgres (agent database)

Still the strongest part of the codebase, and the mandate feature did not weaken it — if anything it demonstrated the boundary is understood. `buyer_mandates` was placed in the **project** schema (`packages/db/src/schema/business.ts:386`) with a comment explaining why: it is authoritative commerce state, whereas what the agent *did* with a mandate is agent data. That is the right call and it was made deliberately.

Re-verified at this commit:

- **The client split holds.** `packages/db/src/index.ts:36-44` still creates two connections with disjoint schemas, so reaching for the wrong client fails at runtime. No agent table is queried with `db`; no business table with `agentDb`.
- **Cross-database reads still authorise against the project DB first** — the trace route, `getOrderTrail`, `getConversationTurns`, `recordFeedback` all follow the pattern.
- **Degradation is still deliberate** — fallback to the project connection when `AGENT_DATABASE_URL` is unset, decorative reads wrapped in try/catch, best-effort telemetry writes.
- **The mandate feature's agent-DB writes go through the sanctioned modules** — `recordAudit` and `recordFailure` in `packages/payments/src/audit.ts`, no new writer.

### Still open

| Old ref | Finding | Status |
|---|---|---|
| **E4.1** | README documents seven tables and five writer modules; there are eleven and eight | Unchanged (see **B6**) |
| **E4.2** | Unbounded cross-database `IN` lists — `packages/ai/src/inventory.ts:220-231` (every cancelled order id in the window), `apps/web/lib/data/activity.ts:73-90` (up to 120 ids, twice) | Unchanged |
| **E4.3** | `hasDedicatedAgentDatabase` exported and never used | **Improved.** Now consumed by `scripts/verify.ts:82,498`. It is still not surfaced anywhere in the running application, so a deployment silently running both schemas in one database still has no in-app signal — but it is no longer dead |
| **E4.4** | The retention argument — the README's headline justification for the split — is still stated and not implemented. No pruning job, no TTL, no `DELETE` outside `scripts/seed.ts`. `agent_tool_calls` and `reasoning_logs` remain the fastest-growing tables with nothing that trims them | Unchanged |
| **E4.5** | `audit_logs` has no retention and **no index on `created_at`** (`packages/db/src/schema/ai.ts:368-371` indexes `merchant_id`, `order_id`, `actor_type`, `action`), while `getActivity` reads the newest 120 with `ORDER BY created_at DESC` | Unchanged. The mandate feature adds four new audit actions, so this table now grows on the payment path too |

---

## E. Testing and CI

**Improved.** `packages/payments` went from no tests and no `test` script to a `test` script and three suites — `approval-policy.test.ts`, `mandate-policy.test.ts`, `mandates.test.ts`, 22 tests. They test the right things: the pure decision functions at their boundaries, the instrument choice, and that a simulated payment id cannot be mistaken for a Razorpay one.

Verified by running the suite at this commit:

| Package | Files | Tests |
|---|---|---|
| `@workspace/ai` | 14 | 183 |
| `@workspace/commerce` | 2 | 71 |
| `@workspace/payments` | 3 | 22 |
| `@workspace/mcp` | 1 | 12 |
| **Total** | **20** | **288 pass, 0 fail** |

Still open:

- **`packages/payments/src/signature.ts` has no tests.** The three verification functions are pure, need no database, and are the boundary every Razorpay callback crosses. This is still the cheapest high-value test in the repository.
- **`settlement.ts` has no tests.** Both **C6** (unreconciled capture amount) and **N2** (cancelled order chargeable) live in `markPaymentCaptured`, and both are state-machine bugs a table-driven test would have caught.
- **`apps/web` has no tests.** All 36 API routes are unverified.
- **Lint is still advisory** (`.github/workflows/ci.yml:41`, `continue-on-error: true`). The backlog is currently **195 errors across 564 files**, measured at this commit. The honest comment is fair, but the number is not visibly falling. `biome ci --changed` would gate new code while leaving the backlog advisory.
- CI still runs `typecheck` and `test` as real gates and still documents why the four `verify:*` suites are excluded. That reasoning is sound and unchanged.

---

## F. Prioritised action list

Ordered by (blast radius × ease). Old references in brackets.

### Do first — money can move wrongly today

1. **Gate the simulated instrument and label it in order state.** Default it off; refuse it when `NODE_ENV === "production"`; add a column so `paid` by simulation is distinguishable from `paid` by Razorpay. — **N1**
2. **Refuse `orderStatus === "cancelled"` in `markPaymentCaptured`**, which closes it for the mandate path, the checkout-verify path and the webhook at once. — **N2**
3. **Reconcile the captured amount against the order total**, and assert `remote.order_id` and `remote.status === "captured"` in `verifyCheckoutPayment`. — **C6**
4. **Create `/checkout/success` and `/checkout/failed`.** Every payment-link payer currently lands on a 404 after paying. — **C3**
5. **Decide who may author a mandate**, and verify `razorpayTokenId` against the caller before storing it. — **N1, N4**
6. **Disable `emailAndPassword`** (seed through a direct adapter call instead), and set `role` to `input: false` or delete the field. — **C2**
7. **Rate-limit `/api/agent/*`, `/api/mcp/*`, `/api/payments/{mandates,pay}` and the auth routes.** Still the cheapest denial-of-wallet vector and still the cheapest fix. — **C8**
8. **Restore `packages/db/drizzle/meta/0013_snapshot.json`.** Two migrations have now been generated over the gap. — **B5**
9. **Constrain `callbackUrl` to the app's own origin.** — **C9**
10. **Add `MANAGER_DEV_OPEN` and `FIRECRAWL_API_KEY` to `.env.example`**, and gate the former on non-production. — **C7, C11**

### Do next — structural

11. Make the mandate's lifetime cap a conditional update rather than a check-then-act. — **N3**
12. Encrypt `razorpay_key_secret` at rest; the code already funnels through `resolveMerchantCredentials`, so the change is contained. — **C1**
13. Delete the three unused Razorpay OAuth columns and the dead branch in `resolveMerchantCredentials` — or clear all five fields on disconnect. — **A3, C4**
14. Unit-test `signature.ts` and `settlement.ts`. — **E**
15. Push `getCatalog`'s price / stock / brand / sort / paging into SQL; stop selecting `embedding`; compute `total` with `count()`; derive facets from a narrow aggregate. — **D1**
16. Filter `listAgentKeys` by merchant in SQL, with an expression index or a real `merchant_id` column. — **D2**
17. Add per-merchant webhook-secret support for connected accounts. — **C5**
18. Label untrusted web-search results as data in the tool output. — **C10**

### Do when convenient — cleanup

19. Delete the five dead files (**A1**) and the 14 unused UI components (**A2**), or adopt the components and delete the local duplicates. The current state is the worst of both.
20. Decide between the two storefronts and delete the loser. This is the root cause of **D1** and of most of **A1**. — **B1**
21. Gate or delete `/preview`. — **B2**
22. Give `guardrails.ts` violations distinct error codes, the way `MandateRefusal` does. — **B3**
23. Update `packages/db/README.md` — eleven tables, eight writer modules, eighteen project migrations. — **B6**
24. Fix the stale `OPENAI_API_KEY` error message in both agent routes. — **A5**
25. Push the remaining ten filter/sort sites into SQL. — **D3**–**D11**
26. Add retention for `agent_tool_calls`, `reasoning_logs` and `audit_logs`, plus a `created_at` index on `audit_logs`. — **E4.4, E4.5**
27. Add the composite indexes: `orders(merchant_id, created_at)`, `buyer_mandates(buyer_identifier, merchant_id, created_at desc)`.
28. Expose `payForOrder` over MCP, or narrow the manifest's transport claim. — **N5**

---

*No source files were modified in producing this report. The only commands run were `bun run test` and `bun run lint`.*
