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
