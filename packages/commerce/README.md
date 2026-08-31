# @workspace/commerce

Deterministic commerce logic — no model, no prompts, no network.

## Why it is not in `packages/ai`

§4 of the project memory is explicit that compatibility validation is
application logic and that the LLM only interprets and explains the result.
Putting the engine here rather than under the AI package makes that structural:
nothing in this package can reach a model even by accident, and the storefront,
the checkout path and the eventual MCP layer can all validate a build without
loading the AI package at all.

## `compatibility`

`validateBuild(components)` returns a `BuildValidation`: every check that could
be evaluated, the worst status among them, an estimated wattage, and whether
the build may proceed to checkout.

The rules are pure functions over the selected parts, one per relationship,
each exported and testable on its own. A rule whose inputs are null returns
`insufficient_data` — never `compatible`.

    bun test

## `builds` and `carts`

`@workspace/commerce/builds` and `@workspace/commerce/carts` are the rows the
rules run on. Unlike the root export they do talk to the database, which is why
they are separate import paths — the engine stays loadable, and testable, with
no `DATABASE_URL` at all.

Every function in both takes a `merchantId` and a `buyerIdentifier` and filters
on both. Neither is ever accepted from a model; they come from the
server-resolved agent context, so a tool cannot reach another shopper's build
or basket however it is called.

Neither module decides a price. A cart line stores what a product cost when it
was added, for display and for noticing the price has since moved. What the
buyer is charged is re-derived from live product rows at checkout.
