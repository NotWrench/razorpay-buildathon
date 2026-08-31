# Plan — Closing the gap to the PC-commerce project memory

> Measured against `AGENTS.md` (project memory) as of 2026-09-01.
> **Scope: backend, data model, agent and tooling only. UI is out of scope** —
> where a capability needs a client contract, this plan defines the API and the
> payload, not the page.

---

## 0. The headline

The agent layer that exists is sound: grounded retrieval, a gated money path, a
real audit trail, two databases. What it is *not* is a PC retailer. The memory
describes a store whose entire value comes from **structured product attributes
and deterministic compatibility rules**, and none of that exists yet.

Ranked by how much each blocks the memory's core scenario (§29, "₹80,000 1440p
gaming build"):

| # | Gap | Blocks |
| --- | --- | --- |
| 1 | No component taxonomy — `products.category` is free text | Everything below |
| 2 | No structured specifications — specs are an untyped `jsonb` blob | Compatibility, comparison, upgrades |
| 3 | No compatibility engine | §4, the Build mode, the whole differentiator |
| 4 | No `Build` / `BuildItem` | §4, §29 |
| 5 | No `Cart` / `CartItem` — carts exist only as an array inside one request | §8 checkout flow |
| 6 | No chat modes, no page context | §6, §7 |
| 7 | No compare capability | §6 |
| 8 | Inventory is a single `products.stock` integer | §10, §11 admin work |
| 9 | Admin agent has analytics but no inventory actions | §11, §12 |
| 10 | No MCP layer | §17 |
| 11 | Tool calls, tasks and feedback are not first-class records | §18, §24 |
| 12 | Catalog is headphones and laptops | §29, §30 demos |

---

## 1. What already satisfies the memory

Worth stating so none of it gets rebuilt:

| Memory section | Status |
| --- | --- |
| §13 Agent architecture — AI SDK + Gemini, tool calling | Done. `packages/ai`, two tool-loop agents |
| §14/§15 Two databases, platform authoritative | Done. `db` + `agentDb`, split clients and migrations |
| §16 Small explicit tools, no `runSql` | Done. 23 tools, all narrow |
| §19 Grounding | Done. Prices only ever come from `quoteCart`; the model picks products and quantities and nothing else |
| §20 Authorization before tool execution | Done. `resolveActor` / `assertMerchantOwner` run in the route; `merchantId` is never taken from the model |
| §21 Payment safety | Done. `@workspace/payments`, webhook-settled, agent orders land `pending_approval` |
| §22 Behaviour principles | Mostly done, enforced in prompts + `toolApproval` |
| §24 Observability | Partial. `audit_logs` + `reasoning_logs` exist; per-tool-call telemetry does not |
| §12 Admin approval-aware mutations | Partial. Campaigns and order approval are gated; inventory actions do not exist |

**One divergence to keep, not fix:** the repo also has an agent-readable
`catalog.json`, a `.well-known/agent-commerce.json` manifest and an external
AI-buyer path. The memory does not mention these; they come from the hackathon
brief. They are additive and should stay.

---

## 2. Phase A — The product domain

Nothing else in this plan works until products are structured. This is the
foundation, and it is mostly schema plus a seed.

### A1. Component taxonomy

```
product_categories
  id, slug ("cpu" | "gpu" | "motherboard" | "ram" | "storage" |
            "psu" | "case" | "cooler" | "fan" | "monitor" | "peripheral"),
  name, sort_order,
  is_build_component  boolean   -- does it occupy a slot in a build?
  build_slot          text      -- "cpu", "gpu", "storage", ...
  min_per_build, max_per_build  -- 1 CPU, 1 motherboard, up to N storage
```

`products.category_id` replaces the free-text `products.category`. Keep the text
column during the migration, backfill, then drop it.

### A2. Typed specifications

The memory (§4) needs specific fields to validate against, and a `jsonb` blob
the model has to interpret defeats the point of deterministic rules. Use a
**typed-per-category spec table** rather than one wide products table:

```
product_specs
  product_id, category_slug,
  -- resolved, queryable columns used by the compatibility engine
  socket              text     -- CPU, motherboard, cooler
  chipset             text
  form_factor         text     -- motherboard (ATX/mATX/ITX), case, PSU
  memory_type         text     -- "DDR4" | "DDR5"
  memory_slots        integer
  memory_speed_mhz    integer
  memory_capacity_gb  integer
  tdp_watts           integer
  recommended_psu_watts integer
  psu_wattage         integer
  pcie_power_connectors jsonb  -- [{ pins: 8, count: 2 }]
  length_mm, height_mm, width_mm integer
  max_gpu_length_mm   integer  -- case
  max_cooler_height_mm integer -- case
  storage_interface   text     -- "M.2 NVMe" | "SATA"
  m2_slots, sata_ports integer
  extra               jsonb    -- genuinely category-specific leftovers
```

Nullable throughout: **a missing spec is the `insufficient_data` signal the
memory asks for in §4**, so it must be distinguishable from a zero. Keep
`products.attributes` for display-only detail.

### A3. Inventory as its own concern

`products.stock` stays as the authoritative on-hand count (payments already draw
it down). Add the operational fields the admin agent needs:

```
inventory
  product_id (unique), low_stock_threshold, reorder_point,
  reorder_quantity, supplier_lead_time_days, last_restocked_at
```

### A4. Seed a real PC catalog

Replace the headphones/laptops seed with ~60 components across all categories,
with **real, consistent specs** — AM5 and LGA1700 CPUs, matching motherboards,
DDR5 kits, GPUs with lengths and power connectors, cases with clearances, PSUs
with wattages. Include deliberate traps for the demo: a GPU too long for one
case, a PSU with too little headroom, a DDR4 kit against a DDR5 board.

Keep the historical-order generator so the admin analytics stay grounded.

**Done when:** `bun run seed` produces a catalog against which every §4
compatibility rule can be exercised, both passing and failing.

---

## 3. Phase B — The compatibility engine

The memory is explicit (§4): this is **deterministic application logic**, and the
LLM only explains the result. Build it as a pure module with no model in it.

`packages/ai/src/compatibility/` — or better, `packages/commerce/` so it is
usable without the AI package.

```ts
type CompatibilityStatus =
  | "compatible"
  | "requires_verification"
  | "incompatible"
  | "insufficient_data";

interface CompatibilityIssue {
  status: CompatibilityStatus;
  rule: string;             // "cpu_motherboard_socket"
  severity: "blocking" | "warning" | "info";
  message: string;          // human-readable, shown verbatim
  affectedProductIds: string[];
  missingSpecs?: string[];  // why it is insufficient_data
  suggestion?: string;
}

interface BuildValidation {
  status: CompatibilityStatus;   // worst of the issues
  issues: CompatibilityIssue[];
  estimatedWattage: number;
  recommendedPsuWattage: number;
  slotsUsed: Record<string, number>;
  canCheckout: boolean;          // false if any blocking issue
}
```

Rules, one function each, each independently testable:

| Rule | Check |
| --- | --- |
| `cpu_motherboard_socket` | sockets equal |
| `motherboard_ram_type` | DDR generation matches |
| `motherboard_ram_slots` | sticks ≤ slots |
| `motherboard_case_form_factor` | ATX board not in an ITX case |
| `gpu_case_clearance` | GPU length ≤ case max |
| `cooler_case_clearance` | cooler height ≤ case max |
| `cooler_cpu_socket` | cooler supports the socket |
| `psu_wattage_headroom` | sum of TDP × 1.3 ≤ PSU wattage |
| `psu_gpu_connectors` | PSU provides the GPU's PCIe connectors |
| `storage_interface_slots` | NVMe count ≤ M.2 slots, SATA ≤ ports |
| `build_completeness` | required slots filled before checkout |

**The rule that matters most:** any rule whose inputs are null returns
`insufficient_data`, never `compatible`. §4 says never silently assume.

**Done when:** a unit test per rule, plus fixtures for a good build, a
socket-mismatch build, an oversized-GPU build and a build with missing specs.
This is deterministic code, so it should be tested without burning model calls.

---

## 4. Phase C — Builds and carts

### C1. Build

```
builds       id, user_id | session_id, merchant_id, name, status
             ("draft" | "validated" | "ordered"), created_at, updated_at
build_items  build_id, product_id, category_slug, quantity, is_primary
```

A build is the structured configuration §2 asks for — the system knows which
slot each product fills, so validation is possible before checkout.

### C2. Cart

```
carts      id, user_id | session_id, merchant_id, status, created_at
cart_items cart_id, product_id, quantity, build_id (nullable), unit_price_paise
```

`build_id` lets a whole validated build enter the cart as a coherent group while
individual components can still be bought loose.

**Where this meets what exists:** `createCheckoutOrder` currently takes an inline
item array. Add a `fromCart(cartId)` path that materialises the cart, **re-runs
validation**, and then calls the existing pricing and order code unchanged. The
gated money path is not touched.

### C3. Tools

Customer, read-only: `getBuild`, `getCart`, `checkBuildCompatibility`.
Customer, mutating (cheap, reversible, not money — no approval gate):
`createBuild`, `updateBuild`, `addToCart`, `removeFromCart`.

`createOrder` gains an optional `cartId` and **refuses when validation returns a
blocking issue**. That refusal is a deterministic backend check, not a prompt
instruction.

---

## 5. Phase D — The customer agent's missing capabilities

### D1. Chat modes (§6)

Add `mode: "about" | "compare" | "recommend" | "build" | "orders"` to the chat
request. A mode selects a prompt fragment and an `activeTools` subset — one agent
implementation, not five, as §6 requires.

The AI SDK's `activeTools` does exactly this: same tool set, different exposure
per turn.

### D2. Page context (§7)

Extend the chat body to the memory's own shape:

```ts
context: {
  page: "product" | "build" | "cart" | "order" | "search" | "home",
  productId?, buildId?, cartId?, orderId?, searchQuery?
}
```

Resolved **server-side into the prompt and the tool context** — the ids are
looked up and authorised, never trusted as passed. `orderId` in particular must
be ownership-checked before it reaches the prompt.

### D3. `compareProducts` (§6)

Takes 2–4 product ids, returns a normalised attribute matrix driven by the
category's spec fields, plus price, availability and a per-attribute "which is
better and by how much". The model narrates the practical difference; it does not
compute the table.

### D4. Requirement capture (§3.2)

```
build_requirements  conversation_id, budget_paise, use_case, target_resolution,
                    target_refresh_hz, workloads jsonb, owned_parts jsonb,
                    constraints jsonb
```

Tools `captureRequirements` / `getRequirements`, so the interview produces
structured state rather than being re-derived from the transcript each turn.
§3.2's "avoid unnecessary questions" then becomes checkable: ask only for fields
that are still null *and* would change the recommendation.

### D5. Two-level recommendation (§3.3, §5)

`recommendProducts` currently records a flat list. Extend to the memory's
contract:

```ts
{
  bestFit:  { productId, reason, confidence, ... },
  upgrade?: {
    productId, additionalSpendPaise, benefit,
    tiedToRequirement: string   // which stated goal this serves
  }
}
```

The upgrade slot is **omitted when no upgrade is justified** — §5's "must not
manipulate users" is enforced by making the absence representable and by
requiring `tiedToRequirement`, so an upgrade with no goal to point at cannot be
expressed.

Keep the existing co-purchase `suggestUpsell` as a separate, evidence-based
cross-sell; it answers a different question.

---

## 6. Phase E — The admin agent's missing capabilities

Existing: `getSalesSummary`, `findSlowMovers`, `getAttachRate`,
`getTopPerformers`, `getAgentOrderQueue`, `approveAgentOrder`,
`rejectAgentOrder`, `draftCampaign`, `activateCampaign`.

### E1. Read tools to add (§9, §10, §16)

`getInventorySummary` — stock health, value on hand, items below threshold.
`getLowStockProducts` — below `low_stock_threshold` or projected to stock out.
`getOrderSummary` — counts and value by status: new, pending, cancelled.
`getCancellationSummary` — cancellations with reasons, from `failures`.
`getStockRisk` — sales velocity vs remaining stock → days of cover.

### E2. Recommendation tools (§11)

`getReorderCandidates` — velocity, cover, suggested quantity, **with the data
window stated** (§10 requires the assumptions be surfaced).
`getDiscountCandidates` — weak velocity, excess stock, ageing inventory.
`getDiscontinueCandidates` — persistent underperformance. §11 is explicit that
this is a recommendation and never an automatic deletion, so there is no
corresponding mutation tool at all.

### E3. Mutations (§12) — gated

`createReorderRequest`, `updateInventoryThreshold`, `createDiscountDraft`
(generalising `draftCampaign`).

```
reorder_requests  id, product_id, quantity, status
                  ("draft" | "approved" | "ordered" | "received"),
                  reason, created_by_agent boolean, approved_by, created_at
```

All three go through the existing `toolApproval` policy — the mechanism proven
for `createOrder` and `activateCampaign`, reused rather than reinvented.

---

## 7. Phase F — MCP layer (§17)

Expose the domain tools over MCP so the agent ecosystem, not just this app, can
reach them:

```
products.search      products.get       products.compare
build.checkCompatibility               build.get
inventory.summary    sales.summary      orders.summary
```

Structured as a thin adapter over the same tool implementations, so there is one
definition per capability. **Auth is the whole design problem here:** the MCP
server must resolve an identity and apply the same customer/admin split
(§20) before dispatch — a customer-scoped connection must not reach
`inventory.summary`. Never expose anything resembling `postgres.executeAnySql`.

---

## 8. Phase G — Observability and evaluation (§24)

### G1. First-class tool-call records

Currently tool calls are jsonb on a message and money actions are audited. §24
wants per-call telemetry:

```
agent_tool_calls  id, conversation_id, agent_type ("customer" | "admin"),
                  mode, tool_name, input jsonb, output_summary jsonb,
                  status ("ok" | "error" | "denied"), error_text,
                  latency_ms, step_number, created_at
```

Written from `onToolExecutionStart` / `onToolExecutionEnd`, which the AI SDK
already exposes — no wrapping of individual tools.

`agent_tasks` (mode, intent, state, outcome) and `agent_feedback`
(recommendation id, thumbs, note) complete the memory's §26 domain model. All of
these live in the **agent database**, which is what it is for.

### G2. Evaluation suite

`scripts/verify.ts` (35 checks) and `scripts/verify-agent.ts` (14) already cover
grounding, guardrails and the approval gate. Extend to §24's list:

- correct product retrieval and accurate comparison
- **correct compatibility detection** — pure logic, so test exhaustively and
  cheaply without the model
- no hallucinated inventory
- permission enforcement and customer/order isolation — a customer agent must
  not reach another customer's order
- useful upgrade recommendations (upgrade omitted when unjustified)
- useful admin reorder recommendations

Compatibility and permissions belong in fast deterministic tests; only the
judgement calls need the model, which also keeps the run inside Gemini's free
tier.

---

## 9. Sequencing

Each phase is independently useful and leaves the system working.

| Phase | Depends on | Delivers |
| --- | --- | --- |
| **A** Product domain | — | Categories, typed specs, inventory, PC seed |
| **B** Compatibility engine | A | Deterministic validation, fully unit-tested |
| **C** Builds and carts | A, B | Persistent build/cart, validated checkout |
| **D** Customer agent | B, C | Modes, page context, compare, requirements, upgrades |
| **E** Admin agent | A | Inventory intelligence, gated reorder/discount actions |
| **F** MCP | D, E | Domain capabilities over MCP with the auth split |
| **G** Observability | any | Tool-call telemetry, feedback, expanded eval |

**A → B → C is the critical path**; nothing in the memory's differentiator works
without it. **E is fully parallel** — it only needs Phase A — so it is the right
work to run alongside if effort splits.

---

## 10. Risks and decisions to make

| Risk / open question | Note |
| --- | --- |
| Spec data quality | The compatibility engine is only as good as the specs. A hand-curated 60-product seed is more valuable than a large scraped one, and `insufficient_data` must stay visible rather than being papered over. |
| Wide spec table vs per-category tables | The plan takes one nullable-wide table: simpler joins, and the engine reads a fixed set of columns. Revisit only if categories diverge sharply. |
| Multi-tenancy | The repo is multi-merchant (`merchants`, store slug); the memory describes a single store with an owner. These are compatible — one merchant row — but every new table above must still carry `merchant_id` to avoid a painful retrofit. |
| `products.category` → `category_id` | A migration with a backfill, on a table with live rows. Keep both columns until the backfill is verified. |
| Cart/build ownership for guests | `user_id` or `session_id`; decide before writing the tables, because it affects every authorization check downstream. |
| MCP auth | The hardest part of Phase F. Do not ship MCP until the customer/admin split is enforced at dispatch. |
| Scope | Phases A–C are the memory's actual differentiator. If time is short, A, B, C and E beat a broad shallow pass at everything. |

---

## 11. Explicitly out of scope here

- **All UI.** Storefront, builder, cart, checkout and admin pages. This plan
  defines the APIs and payloads they would consume.
- The existing agentic-commerce surface (`catalog.json`, the
  `.well-known` manifest, the external AI-buyer script) — already built, and
  additive to the memory rather than in conflict with it.
- Anything already listed as done in §1 above.
