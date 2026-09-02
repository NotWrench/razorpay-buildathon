import type { Route } from "next";

export type RowKind = "category" | "suggestion" | "product" | "assistant";

/**
 * One stop on the keyboard walk.
 *
 * A suggestion carries a `value` and no href — choosing one refines the term
 * rather than leaving the overlay, because a suggestion is a query, not a
 * destination.
 */
export interface Row {
  href?: Route;
  key: string;
  kind: RowKind;
  value?: string;
}
