# Demo runbook

> Ten beats, about eight minutes. Every one of them exercises code that already
> exists — nothing here is staged, and nothing needs a code change on the day.
>
> The spine is deliberate: **the buyer's room, then the agent's room, then the
> failure, then the trail.** The failure is beat 7 rather than last, because a
> demo that ends on a refusal reads as an apology and a demo that ends on the
> audit trail reads as rigour.

---

## Before you start

```bash
bun run db:up
bun run db:migrate
bun run seed          # destructive by design — a clean store every time
bun run embed
bun run dev
```

Four tabs, in this order, so no beat waits on a page load:

1. `http://localhost:3000/store/alfred/assistant`
2. `http://localhost:3000/manager`
3. `http://localhost:3000/manager/orders`
4. `http://localhost:3000/manager/activity`

Plus a terminal in the repo root.

**Issue the buying agent's key first.** Go to `/manager/agents`, create a key
with a **₹25,000 cap** (beat 7 depends on that number being low), and put it in
`.env` as `AI_BUYER_API_KEY`. Do this before the demo — the key is shown once.

**Sanity check** — if this prints a product, everything is up:

```bash
curl -s localhost:3000/store/alfred/catalog.json | jq '.products[0].name'
```

---

## The ten beats

### 1 — The buyer does not know what they want (60s)

**Tab 1.** Type:

> I need a gaming PC around ₹80,000 for 1440p. Mostly competitive shooters.

The agent asks at most one or two questions, then searches the *real* catalog
and proposes parts with prices it did not invent. Point at the reasoning trail
as it streams — the buyer can see what it is doing, not just what it decided.

**Say:** every price on screen came from `quoteOrder`. The model chose products
and quantities; it was never allowed near a number.

### 2 — Compatibility refuses to guess (45s)

Ask it to swap in a part that will not fit — an ITX case with an ATX board, or a
cooler with the wrong socket.

The engine in `packages/commerce` is deterministic, not a prompt. It returns a
status per rule, and where a specification is missing it returns
**`insufficient_data`** rather than `compatible`.

**Say:** that third state is the whole point. A missing spec is not a pass. The
agent will tell the buyer to check the measurement rather than quietly assert
it fits.

### 3 — A human pays, in test mode (45s)

Add to cart, check out, open the Razorpay window.

Point at the **"Test mode — this payment moves no real money"** line under the
store name. Razorpay paints no test badge of its own; that line is ours, and the
same fact is stamped onto the payment record's `notes`.

Pay with `4111 1111 1111 1111`, any future expiry, any CVV.

**Say:** the browser did not decide this succeeded. `/api/payments/verify`
checked the HMAC signature, and the webhook settles the order independently.

### 4 — An AI buyer that has never seen this code (60s)

**Terminal:**

```bash
bun run ai-buyer -- --budget 20000 --want "a graphics card for 1440p gaming"
```

Read the steps out as they print: it fetches the manifest, picks the store,
fetches that store's catalog, chooses on stated criteria, and posts an order.

**Say:** this script has zero `@workspace` imports and no database access. It
knows one URL and an API key. If it works, the merchant is transactable by an AI
buyer — not merely by *our* AI.

### 5 — Nothing was charged (30s)

The script stops and prints `pending_approval`.

**Tab 3, `/manager/orders`.** The order is sitting in the queue with the agent's
`aiPurchaseReason` visible — the reason it gave for buying, in plain language,
addressed to the human who decides.

**Say:** Razorpay has not been called. There is no payment instrument attached to
this order. The gate is not a UI convention, it is the absence of a charge.

### 6 — The merchant approves, and money moves (45s)

Approve it. The script — still polling — wakes up, requests a payment link and
prints it. Open the link, pay in test mode, and watch the order settle.

**Say:** approval is what creates the Razorpay order. Everything before it was a
proposal.

### 7 — The failure (60s) ← the beat that matters

**Terminal.** Run the buyer again, over its key's cap:

```bash
bun run ai-buyer -- --budget 40000 --want "a high end graphics card"
```

It is refused with a message that names the numbers: what is already committed,
what the cap is, and what the total would have been.

**Say:** three things happened, and none of them is a crash. Nothing was
ordered. Nothing was charged. And it is *written down* — a
`BUDGET_CHECK_FAILED` in the audit log and a row in `failures`, both of which
the merchant can see in a moment.

> If the cap does not trip, the key's limit is too high. Issue a fresh key at
> `/manager/agents` with a ₹25,000 cap and re-run.

### 8 — The trail (45s)

**Tab 4, `/manager/activity`.**

One stream. The human's checkout, the buying agent's order, the merchant's
approval, and the refusal from beat 7 — interleaved, each labelled with who did
it.

**Say:** human and agent actions are deliberately not split into two feeds. The
question a merchant has is "who changed this price", and two feeds make them
look twice. The failure sits next to the successes, which is where it belongs.

Then expand the order from beat 6 in the table. Its own trail is inside the row:
every audited action in sequence, and beneath it what did not work with the
recovery beside it. The buyer sees the same record on their own order page.

**Say:** the failure is not filed somewhere else. A refund Razorpay refused sits
next to the refund that worked, because that is where anyone looking for it
would look.

The same record is available to anyone else at
`http://localhost:3000/api/agent/trace/{orderId}`.

### 9 — The other agent, growing revenue (60s)

**Tab 2, `/manager`.** Type:

> What should I discount this week?

It pulls sales and margin over two windows, finds slow movers with real stock
behind them, and drafts **one** campaign — with a budget, an end date, and the
evidence it used.

**Say:** the campaign is `pending_approval`. It discounts nothing. And it has a
budget in paise, so even once it is live it stops on its own — a campaign that
can be started and not stopped is the one genuinely dangerous object in a system
like this.

### 10 — The bound the merchant chose (45s)

Ask for something the policy will not allow:

> Take 40% off the RTX 4060 Ti.

Two things refuse it, and the agent explains which. The **discount cap** clamps
the percentage. The **margin floor** checks the result against `cost_price` and
refuses outright if the product would sell below cost — naming the product, the
discounted price and the cost.

Then show `/manager/account`, where those numbers live. Drop the discount cap to
10% and ask again — the same request now clamps at 10.

**Say:** these are the merchant's numbers, not ours. They can only ever be
stricter than the platform ceiling — a merchant cannot raise their own cap to
80% — and the store's effective policy is republished in the discovery manifest,
so a counterparty agent knows the rules before it engages.

Finish on the manifest:

```bash
curl -s localhost:3000/.well-known/agent-commerce.json | jq '.stores[0].policy, .protocols'
```

**Say:** the bounds are published, not just enforced — and the protocols block
says plainly what this endpoint speaks and what it does not, because a manifest
that claims conformance it has not proved costs a counterparty a failed
integration to find out.

### If there is a spare minute

```bash
bun run nightly -- --slug alfred
```

The merchant agent with nobody watching. It reads, it reasons, it leaves at most
one drafted campaign and one reorder — and it prints the tools it was *stopped*
on, because every money tool suspends for an approval nobody is there to give.
Then show `/manager/activity`: those entries carry an **unattended** badge.

---

## If something goes wrong

| Symptom | Cause | Fix |
| --- | --- | --- |
| Assistant returns nothing | No model key, or the provider's quota is spent | Check `AI_PROVIDER` matches the key you set. Everything except chat still works |
| Search returns odd results | Embeddings not built, or built with a different model | `bun run embed` |
| `ai-buyer` gets 401 | `AI_BUYER_API_KEY` unset or revoked | Issue a fresh key at `/manager/agents` |
| `ai-buyer` gets "issued for a different store" | Key scoped to another merchant | Expected. Issue one for `alfred` |
| Checkout window refuses to open | An `rzp_live_` key reached it | Expected, and the point. Use `rzp_test_` |
| Order stays `created` after paying | Webhook cannot reach localhost | Use the payment-link callback, or expose the port |
| Manager screens are empty | Signed in as someone who owns no store | `SEED_OWNER_EMAIL` must be your Google address; re-run `bun run seed` |

---

## The one-sentence version

*A shopper and a merchant each get an agent; a stranger's agent can trade with
the merchant over HTTP; and every rupee any of them moves is explained, bounded,
gated and written down.*
