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
