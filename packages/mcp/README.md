# @workspace/mcp

The store's domain capabilities over the Model Context Protocol (§17).

## The scope split is the whole design

An MCP endpoint is a door with no UI in front of it, so authorization cannot
live in a page or a prompt. Two rules carry it:

**Scope is checked before dispatch.** A capability declares which scopes may
reach it, and `capabilitiesFor` never returns one the caller is not entitled
to. A customer-scoped connection is not told `inventory.summary` exists, let
alone allowed to call it — it is absent from `tools/list` and unresolvable in
`tools/call`.

**Nothing is taken from the caller that identifies them.** No capability
accepts a merchant id or a buyer identity as an argument. Both come from the
server-resolved `AgentContext`, exactly as they do in the chat route, so a
crafted request cannot shop as somebody else or read another store.

The server is built per request and discarded, so a connection cannot outlive
the authorization that opened it. There is no session holding a stale scope.

The table of what each scope may reach lives in `capabilities.ts`, which
imports nothing that touches a database or a model — so it can be audited, and
tested, without booting the app. `dispatch.ts` runs them.

## One definition per capability

Every entry delegates to the same tool the in-app agent calls. There is no
second implementation of product search to drift out of step with the first.

Nothing resembling `postgres.executeAnySql` appears here, and nothing should.

## What a buyer may do

| Capability | Scope |
| --- | --- |
| `products.search`, `products.get`, `products.compare` | customer, merchant |
| `build.checkCompatibility`, `build.get` | customer, merchant |
| `checkout.quote`, `orders.create`, `orders.status`, `orders.cancel`, `payment.link` | customer, merchant |
| `inventory.summary`, `sales.summary`, `orders.summary` | merchant only |

The money path was absent for a while, and its absence was the reason an
MCP-native buyer could browse this store and then had to leave the protocol to
buy anything — "transactable end to end" was true over REST and false over the
transport built to make it true.

Adding it changed no bound. Each capability delegates to the tool the agent
already calls, so the spend cap is checked inside `execute` before any write,
and `createCheckoutOrder` still stamps an order from an API-key buyer
`pending_approval` with no Razorpay order behind it. A caller gets exactly what
`POST /api/payments/orders` already gives the same identity.

What moves is *where the human presses the button*. The in-app agent suspends
its loop for an approval card; an MCP client has no such loop, and its own host
is the surface that asks its user before calling a tool. That is the standard
shape, and it is why the guarantee that matters was never the gate — it is the
database refusing to attach a payment instrument to an order no merchant has
approved.

Deciding for somebody else's money stays off the protocol entirely. There is no
`refund`, no `approve`, no price move and no campaign capability, at any scope.
`scope.test.ts` asserts it.
