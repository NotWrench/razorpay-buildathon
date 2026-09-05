import type { CategorySlug } from "@workspace/db/taxonomy";
import type { Candidate } from "./build-upgrades";

/**
 * Resolving a part the buyer named to a row the merchant stocks.
 *
 * "Build me a PC with an RTX 5090" used to lose the RTX 5090. The assembler
 * chose every slot from a share of the budget and nothing else, so the one
 * part the buyer actually asked for was the one thing their sentence could not
 * influence — the machine came back with whatever card fitted 35% of the
 * budget, and at every budget a person would plausibly state that was never
 * the card they named. Worse, nothing said so: the build looked like an
 * answer.
 *
 * So a named part is resolved here, deterministically, against the same rows
 * the assembler already loaded. Deterministically because §4 keeps commerce
 * choices out of the model, and against the loaded rows because a pin that
 * needed its own query could disagree with the pool the build is chosen from.
 *
 * The other half of the job is saying no. A part this store does not sell, or
 * sells but has none of, comes back in `unmatched` with the reason — never as
 * a silent substitution, which is the failure this file exists to end.
 */

/** A part the buyer named, resolved to a row. */
export interface PinnedSlot {
  candidate: Candidate;
  /** What the buyer called it, so the agent can quote them back. */
  request: string;
  slug: CategorySlug;
}

export type PinFailure =
  /** The store sells it and has none. */
  | "out-of-stock"
  /** Nothing in the catalog matches the words. */
  | "not-stocked"
  /** A part was already pinned for that slot; a machine takes one. */
  | "slot-taken";

export interface UnmatchedPin {
  /** Named when the failure is `out-of-stock` or `slot-taken`. */
  match?: string;
  reason: PinFailure;
  request: string;
  /** Set on `slot-taken`, so the agent can say which two collided. */
  slug?: CategorySlug;
}

export interface PinResolution {
  pinned: Map<CategorySlug, PinnedSlot>;
  unmatched: UnmatchedPin[];
}

const NON_ALPHANUMERIC = /[^a-z0-9]+/g;

/**
 * Words that carry no identity, dropped so a pin survives being phrased.
 *
 * "an RTX 5090 graphics card" and "RTX 5090" have to resolve to the same row.
 * The list is short on purpose: every word removed is a word that can no
 * longer distinguish two products, and the catalog is full of parts whose
 * names differ by one.
 */
const NOISE = new Set([
  "a",
  "an",
  "card",
  "cpu",
  "gpu",
  "graphics",
  "the",
  "with",
]);

function normalise(value: string): string {
  return value.toLowerCase().replace(NON_ALPHANUMERIC, " ").trim();
}

function tokens(value: string): string[] {
  const all = normalise(value).split(" ").filter(Boolean);
  const meaningful = all.filter((token) => !NOISE.has(token));

  /* All noise is still a request. Better a loose match than none at all. */
  return meaningful.length > 0 ? meaningful : all;
}

/** Name, SKU and brand — never the description, which name-drops other parts. */
function haystack(entry: Candidate): string {
  return normalise(
    [entry.product.name, entry.product.sku, entry.product.brand]
      .filter(Boolean)
      .join(" ")
  );
}

/**
 * How well a row answers the words, or null when it does not answer them.
 *
 * Every token has to appear, so "RTX 5090" cannot land on an RTX 5070. Among
 * the rows that do answer, the tightest wins: "RTX 5070" names the ASUS Dual
 * RTX 5070 rather than the RTX 5070 Ti, because the Ti's name carries more
 * words the buyer did not say. Cheapest breaks a tie, which is the only
 * direction a tie should ever be broken in.
 */
function score(entry: Candidate, wanted: string[]): number | null {
  const text = haystack(entry);

  if (!wanted.every((token) => text.includes(token))) {
    return null;
  }

  return text.split(" ").filter(Boolean).length;
}

function bestMatch(pool: Candidate[], wanted: string[]): Candidate | null {
  let best: Candidate | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const entry of pool) {
    const entryScore = score(entry, wanted);

    if (entryScore === null) {
      continue;
    }

    if (
      entryScore < bestScore ||
      (entryScore === bestScore &&
        best !== null &&
        entry.product.price < best.product.price)
    ) {
      best = entry;
      bestScore = entryScore;
    }
  }

  return best;
}

/**
 * Pins every part the buyer named, and reports the ones that cannot be.
 *
 * `sellable` is what the assembler may choose from; `excluded` is everything
 * else the store lists — out of stock, or in no category the builder knows.
 * Searching both is what lets the answer be "we stock that and it is out"
 * rather than the same shrug a part we never sold would get.
 */
export function resolvePins(
  sellable: Candidate[],
  excluded: Candidate[],
  requests: readonly string[]
): PinResolution {
  const pinned = new Map<CategorySlug, PinnedSlot>();
  const unmatched: UnmatchedPin[] = [];

  for (const request of requests) {
    const wanted = tokens(request);

    if (wanted.length === 0) {
      continue;
    }

    const match = bestMatch(sellable, wanted);

    if (!match) {
      const shelved = bestMatch(excluded, wanted);

      unmatched.push(
        shelved
          ? {
              match: shelved.product.name,
              reason: "out-of-stock",
              request,
            }
          : { reason: "not-stocked", request }
      );
      continue;
    }

    const taken = pinned.get(match.category);

    if (taken) {
      unmatched.push({
        match: taken.candidate.product.name,
        reason: "slot-taken",
        request,
        slug: match.category,
      });
      continue;
    }

    pinned.set(match.category, {
      candidate: match,
      request,
      slug: match.category,
    });
  }

  return { pinned, unmatched };
}
