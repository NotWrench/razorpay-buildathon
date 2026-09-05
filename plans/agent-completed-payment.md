# Plan — Agent-completed payment: two delegations, no human in the loop

> **Status: implemented, 2026-09-05.** All six phases shipped, in `0a81c28`,
> `c9db99b`, `891c8d9`, `b95fda5`, `6a7b454` and `394e649`. `bun run typecheck`
> and `bun run test` green after each; 288 tests, 22 of them new.
>
> Four departures from what is written below, each recorded in place at the
> phase it belongs to. Three of them are the same lesson learned three times:
> **`ai → payments → commerce → db` decides where a rule lives.** The approval
> policy, the mandate guardrail and the rupee formatter all began this plan
> sitting in `@workspace/ai` and all three had to move, because the order path
> cannot import the agent layer and a bound written there binds only the caller
> that remembered to run it. The fourth was a genuine mistake in the design:
> pointing the buyer's confirmation card at the *merchant's* ceiling, which
> would have let a shop suppress its own customer's confirmation.
>
> Two things were found by running it rather than by reading it, and neither is
> in this plan:
>
> - **`MANDATE_REVOKED` was unreachable.** `findMandate` filtered out revoked
>   rows, so a withdrawal came back as the blander "you have no authorisation
>   here" — true only in the sense that matters least. The row is now returned
>   either way and `checkMandate` says what is actually wrong; `findLiveMandate`
>   serves the callers that must not render a withdrawn mandate as live.
> - **The refusal messages had their own rupee formatter**, which printed
>   ₹16,850.90 as "₹16,850.9" — the exact bug `formatPaise` already carries a
>   comment about. That is what sent the formatter across the package boundary.
>
> Verified against the running app and both databases: authorise, order,
> charge, settle, withdraw, refuse. §6's four rows are real.
>
> **Still outstanding, and it is a dashboard question rather than a code one:**
> whether this Razorpay account has Recurring Payments enabled. Until it does,
> every mandate settles through the `simulated` instrument — labelled on the
> payment record, the audit entry, the API response, the buyer's screen and in
> a payment id deliberately not `pay_`-shaped. §7 is why that cannot block
> anything.

> Measured against the tree at `260192a` (master, clean) on 2026-09-05.
> Scope: make the AI-buyer path complete **end to end**, without weakening any
> bound the project publishes.

---

## 0. The seam

`scripts/ai-buyer.ts` ends at line 251 by printing a payment link URL for a
human to click. Everything before that line is agentic; that line is not. The
track asks for a merchant "transactable by an AI buyer end to end", and the last
mile is the one we do not do.

Two gates stand between an agent's intent and a settled order:

| Gate | Whose decision | Where it lives today |
| --- | --- | --- |
| The merchant must approve the agent's order | Merchant | `initialApprovalStatus` in `packages/payments/src/orders.ts:64` — hardcoded on `buyerType`, consults nothing |
| A human must complete the payment | Buyer | Nowhere. There is no instrument an agent could use even if the buyer consented |

Neither gate is wrong. Both are *unconditional*, which is a different thing —
and the first one is worse than unconditional, it is **published as conditional
and enforced as absolute**. `merchant_policy.agentOrdersRequireApproval` is
stored (`business.ts:248`), clamped (`policy.ts:71`), described in sentences
(`policy.ts:190`), rendered on the account screen (`policy-form.tsx:234`) and
served in the manifest (`agent-commerce.json/route.ts:165`). Nothing reads it
when an order is created. A merchant can switch it off and watch nothing happen.

That is the same class of defect the conformance plan called an *integrity gap*:
a claim the code makes to the outside world that is wider than what the code
does. It is fixed first, before anything new is built on top of it.

---

## 1. What "gated" has to mean

The bar is *"every money action explainable, bounded and gated"*. A human
clicking is the crudest way to satisfy that clause and the only one that cannot
survive contact with agent-to-agent commerce — which is the premise of UAP, AP2
and x402 being named in the brief at all. AP2's own vocabulary is Intent Mandate
→ Cart Mandate → payment: the human signs **bounds**, not each transaction.

So the reading this plan adopts:

> **Gated** means no money moves outside an explicit, bounded, revocable and
> published authority — not that a person clicks each time.

Under that reading the human-approval path does not disappear. It becomes the
**fallback for a purchase no delegation covers**, which is what it should always
have been. The default path becomes: both sides have said, in advance and in
numbers, what they will allow; the agents transact; the trail records who
delegated what.

Concretely, both gates become expressible as policy:

| Gate | Delegating party | The object that carries the decision |
| --- | --- | --- |
| Merchant approval | Merchant | `merchant_policy` (exists) + a per-key ceiling on `ApiKeyMetadata` (new) |
| Payment | Buyer | **`buyer_mandates`** (new) |

Both get published in `/.well-known/agent-commerce.json`, because a counterparty
should be able to learn the terms before spending a request discovering them.

---

## 2. Phases

Each phase is independently shippable, leaves the tree green, and is committed
on its own. Phases 1 and 2 are pure integrity and schema work with no Razorpay
surface; the risk in §7 does not touch them.

### Phase 1 — Make the merchant's stated policy real

**Problem.** `initialApprovalStatus(buyerType)` returns `pending_approval` for
every agent order regardless of what the merchant decided.

**Change.**

- `packages/payments/src/orders.ts` — `initialApprovalStatus` takes the
  effective policy and the order total, and returns `approved` when the merchant
  has switched approval off *and* the total sits under their ceiling. Two
  conditions, not one: a merchant who says "small orders may flow" has not said
  "any order may flow", and reading the toggle alone would turn a ₹5,000
  intention into an unbounded one.
- The policy is read in the payments package through a narrow accessor rather
  than importing `@workspace/ai` — payments must not depend on the agent layer.
  `getEffectivePolicy` moves to, or is mirrored from, a place both can import.
- `ApiKeyMetadata` gains `autoApproveCeilingPaise` beside `spendCapPaise`
  (`packages/db/src/schema/auth.ts:113`). The effective ceiling for an order is
  the **stricter** of the merchant's policy and the one attached to the key that
  placed it, so trusting one counterparty never loosens the shop-wide number.
- `ORDER_AUTO_APPROVED` audit action, naming which delegation cleared it and
  what headroom remained.

**Departure, found while building.** This phase was going to point
`AgentContext.autoApproveCeilingPaise` at the merchant's policy too, so the
buyer's confirmation card in `agents/approval.ts` would open on the same number.
That is wrong, and the error is instructive: the card in `storefrontApproval` is
the **buyer** confirming their own purchase, and the merchant's policy is not
the buyer's consent. Letting a shop's setting suppress a shopper's confirmation
would have been a merchant granting themselves permission on their customer's
behalf — the exact shape of thing this plan exists to make explicit.

So Phase 1 touches only the merchant-side gate. `approval.ts` and
`AgentContext` are untouched; `autoApproveCeilingPaise()` becomes a re-export of
the one platform constant now owned by `@workspace/payments`, so the number a
merchant is shown and the number an order is measured against cannot drift. The
buyer-side ceiling is a buyer's delegation and arrives with the mandate in
Phase 4.

**Proves.** A merchant order can now clear without a human, on the merchant's
own stated terms. Payment still requires one. Nothing about Razorpay changed.

**Tests.** Policy default (approval required) still gates; toggle off with a
ceiling above/below the total; per-key ceiling stricter than policy wins;
per-key ceiling *looser* than policy is ignored.

---

### Phase 2 — The buyer mandate: schema, guardrail, failure modes

**New table** `buyer_mandates`, platform database (it is authoritative commerce
state, not agent state — §15 of `AGENTS.md`):

```
id                  uuid pk
buyerIdentifier     text            -- who delegated
userId              text null       -- the app user, when signed in
merchantId          uuid            -- one store, like an agent key
razorpayCustomerId  text            -- cust_*
razorpayTokenId     text            -- token_*
instrument          text            -- 'recurring' | 'simulated'
maxPerOrderPaise    integer         -- the per-transaction bound
maxTotalPaise       integer         -- the lifetime bound
spentPaise          integer default 0
expiresAt           timestamp
revokedAt           timestamp null  -- revocation is a row, not a delete
createdAt / updatedAt
```

`revokedAt` rather than a delete: a mandate that authorized three charges must
stay readable by the audit trail after it is withdrawn, or the trail cannot
explain payments it already made.

**New guardrail** `assertMandateCovers`. Checks, in order: merchant scope,
revocation, expiry, per-order cap, remaining total. It fails **before** Razorpay
is called, exactly as `assertSpendCapFor` does — nothing half-charged, nothing
to unwind. The order of those checks is itself a decision: "you took this back"
is the true answer even when the mandate is also out of money, and it is the one
the buyer needs to hear.

**Departure.** It lives in `packages/payments/src/mandate-policy.ts`, not in
`packages/ai/src/guardrails.ts` as written above — the same lesson Phase 1
learned about `resolveOrderApproval`. The charge path cannot import the agent
layer, so a bound written there would bind only the caller that remembered to
run it. `guardrails.ts` re-exports it, because "what bounds an agent" is a
question people ask of that file. The decision is split into a pure
`checkMandate` (no database, and the clock passed in) and an
`assertMandateCovers` that logs and throws, so the boundary cases are testable
without a seeded row and without waiting for a date to pass.

**Three failure codes** for `failures` and the README table, all recoverable in
the same turn by falling back to a payment link:

| Code | When | What the agent says |
| --- | --- | --- |
| `MANDATE_EXHAUSTED` | Remaining total is short | By how much, and what is left |
| `MANDATE_EXPIRED` | Past `expiresAt` | When it lapsed |
| `MANDATE_REVOKED` | `revokedAt` is set | That the buyer withdrew it |

**Proves.** The bound exists and is enforceable before any charging code does.
Fully unit-testable with no gateway.

---

### Phase 3 — The `PaymentInstrument` seam

**New** `packages/payments/src/mandates.ts`:

```ts
interface PaymentInstrument {
  charge(input: ChargeInput): Promise<ChargeResult>;
}
```

Two implementations behind one factory chosen by the mandate's `instrument`
column:

- **`recurring`** — `payments.createRecurringPayment({ order_id, customer_id,
  token, recurring: true, ... })` against the merchant's gateway.
- **`simulated`** — drives the existing settlement path directly and stamps
  `instrument: "mandate_simulated"` on the payment record *and* the audit entry.

The simulated path is not a fake capture pretending to be real; it is a labelled
one, and the label travels into the trail a judge reads. See §7 for why it
exists.

Settlement is untouched either way. `markPaymentAuthorized` /
`markPaymentCaptured` in `settlement.ts` and the webhook at
`app/api/webhooks/razorpay/route.ts` already settle idempotently, so an
autonomous charge lands in the same `payments` rows, decrements the same
campaign budget, and appears in the same trail as a human one. That is the whole
argument for putting the seam here rather than beside the agent.

**Order of operations**, which is the whole safety argument: the bound is
checked and throws first, the gateway is called second, and the mandate's
running total is advanced only *after* settlement confirms the money moved. A
mandate debited for a charge that failed would refuse the buyer's next purchase
for a reason that never happened — a worse failure than the one it was guarding
against. The headroom moves by a relative update, so two charges settling at the
same instant both count.

**Found while building.** Razorpay's recurring API requires `email` and
`contact` on every charge, and by the time `chargeMandate` runs there is no
browser and no session left to ask. They are captured when the mandate is
authorised and stored on the row, so the missing-detail failure surfaces at
setup rather than at the moment money is supposed to move. Migration `0017`.

**Proves.** A charge can be initiated server-side without a browser.

---

### Phase 4 — Move the gate, don't remove it

- `packages/ai/src/agents/approval.ts` — `payForOrder` is the conditional gate.
  A covering mandate returns `undefined` and the loop proceeds; no mandate, an
  exhausted one or an expired one still returns `requireApproval`, carrying the
  actual reason so the card says why rather than asking a generic question.

**Departure.** `createPaymentLink` stays unconditional, contrary to the line
above. A mandate is the buyer authorising *this store* to charge *them*; a
payment link is a URL anyone holding it can pay. They are not the same
permission, and a delegation to do the first is not consent to hand out the
second.

The coverage question is asked by `packages/ai/src/mandate.ts`, shared between
the gate and the tool so the two can never disagree — a gate that let a purchase
through which the tool then refused would have the buyer watching their agent
claim authority it did not have. It reads with `checkMandate` rather than
`assertMandateCovers`, because asking is not attempting: a gate that logged a
refusal every time it looked would fill the failure log with purchases nobody
made.
- New storefront tool `payForOrder(orderId)` in `tools/checkout.ts`: resolves
  the mandate for `ctx.actor`, asserts coverage, charges, records
  `AUTONOMOUS_CHARGE` with the mandate id, the headroom before and after, and
  the `aiPurchaseReason` the order already carries.
- `POST /api/payments/pay` — the same thing for an external agent holding an API
  key, which is the endpoint the buyer script will call.
- The reason string does not vanish when the gate opens. It becomes the
  explanation on the audit row. This is the phase where "explainable" has to
  survive the loss of the confirmation card, and the audit entry is how.

**Proves.** End to end, in code, for both the in-app agent and an API caller.

---

### Phase 5 — Setting one up, and taking it away

- `/store/{slug}` gains a mandate panel: the buyer sees `maxPerOrder`,
  `maxTotal` and `expiresAt` **before** authorizing, authorizes through one
  real Razorpay checkout with `recurring: 1`, and can revoke in one click.
- `/manager/activity` renders an autonomous charge with the delegation that
  authorized it beside it — the merchant's question is still "who authorized
  this", and the answer is now a mandate rather than a person.
- `/manager/account` gains the per-key ceiling from Phase 1.

**Proves.** The bound is visible to the person who set it, and revocable by
them. Revoking live on stage and watching the next charge refuse is a better
demonstration of "revocable" than any paragraph.

---

### Phase 6 — End to end, published, documented

- `scripts/ai-buyer.ts` — replace the printed URL with a call to
  `POST /api/payments/pay` and a settled order. **Still zero `@workspace/*`
  imports**: it discovers mandate support from the manifest like everything
  else. That constraint is the entire evidentiary value of the script.
- Manifest — a `mandates` block: whether the store accepts mandate payment, the
  ceilings it will honour, how to establish one, and the failure codes a
  counterparty should expect.
- `README.md` — the failure table gains three rows; the 60-second walkthrough
  ends at a settled order rather than a URL.
- `AGENTS.md` §21 — currently says the AI "should not fabricate payment
  outcomes". Still true and now load-bearing: the agent may *initiate* a
  payment, and may still only report the outcome the gateway confirmed.

---

## 3. What gets removed

`AGENT_AUTO_APPROVE_CEILING_PAISE` as a global environment variable. Per-key and
per-mandate values replace it. One number set per deployment was always the
weakest form of the argument this project makes — it is a developer's promise on
a merchant's behalf, which is the thing `merchant_policy` was introduced to
stop. `platformCeilings()` keeps a platform maximum; the *decision* moves to the
parties.

---

## 4. What does not change

- No tool ever accepts `merchantId`, `buyerIdentifier`, `userId` or a price from
  the model. A mandate is resolved from `ctx.actor` server-side; the model names
  an order id and nothing else.
- The platform ceiling still wins over every merchant number, and the merchant
  number still wins over every per-key number. `stricter()` is the rule
  throughout.
- Test mode is still enforced at every point credentials resolve. A mandate
  established against an `rzp_live_` key is refused for the same reason
  everything else is.
- The compatibility engine, the campaign lifecycle and the merchant agent are
  untouched.

---

## 5. Sequencing

Phase 1 is worth shipping alone: it closes a live integrity gap regardless of
what follows. Phase 2 is pure schema and pure functions. Phase 3 is the only one
carrying gateway risk, and §7's seam is what keeps that risk off phases 4-6.
Phases 4 and 5 can be built in either order; 6 is last because it documents what
the others did.

---

## 6. Evidence to keep

Every phase adds to the trail rather than to a log. By the end,
`/manager/activity` should be able to show, in one stream:

1. A buyer establishing a mandate, with its bounds.
2. An agent order auto-approved under the merchant's policy, naming the ceiling.
3. An autonomous charge, naming the mandate and the headroom it consumed.
4. A second charge refused because the buyer revoked the mandate between them.

Four rows, no human action among them, each one explaining itself. That is the
bar restated as a screenshot.

---

## 7. The risk, and why it cannot block the build

`payments.createRecurringPayment` requires **Recurring Payments enabled on the
Razorpay account**; UPI Autopay and emandate need activation beyond plain
`rzp_test_` keys. This must be checked on the dashboard before Phase 3 starts.
If it is off, the headline path is dark.

The `PaymentInstrument` seam is the answer. The schema, the guardrail, the audit
trail, the agent tool, the manifest block and the buyer script are identical
under both implementations; only the class behind the interface differs, and the
one that does not call Razorpay says so in the record it writes. The gateway
question therefore cannot stall the plan, and does not have to be answered
today.
