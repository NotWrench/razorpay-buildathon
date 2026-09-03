"use server";

import { searchIdle, searchQuery } from "@/lib/data";
import type { SearchOverlayData } from "@/lib/data/types";

/**
 * The header's search overlay, from the client.
 *
 * The overlay opens on a keystroke and re-queries as the shopper types, so it
 * cannot be a server component — but the query itself has to run where the
 * database is. Two actions rather than a route handler: the shapes are the
 * contract in `lib/data/types.ts` and stay typed end to end, and there is no
 * URL for anyone to scrape the catalogue through.
 *
 * The term is clamped rather than validated. An action that throws on a bad
 * payload answers with a 500 and an opaque digest, and there is nothing a
 * shopper could do about it — an over-long or non-string term has an obvious
 * safe reading, so it gets one.
 */

const MAX_TERM = 200;

export async function searchIdleAction(): Promise<SearchOverlayData["idle"]> {
  return await searchIdle();
}

export async function searchQueryAction(
  term: string
): Promise<SearchOverlayData["typing"]> {
  const needle = typeof term === "string" ? term.slice(0, MAX_TERM) : "";

  return await searchQuery(needle);
}
