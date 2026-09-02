import { describe, expect, test } from "bun:test";
import {
  canonicalCategory,
  namesOnlyACategory,
  queryTerms,
} from "../src/search-terms";

/**
 * The lexical path's understanding of a query, checked without a database.
 *
 * These are the decisions that made the agent answer "I need a laptop for
 * ₹5,000" with ten cheap PC components: which words are worth matching, and
 * whether a query names a kind of product at all.
 */

describe("queryTerms", () => {
  test("drops filler that would outvote the real terms", () => {
    expect(queryTerms("what is the best graphics card for gaming")).toEqual([
      "gpu",
      "graphics",
      "card",
      "gaming",
    ]);
  });

  test("puts the named category first, where the six-term cap cannot drop it", () => {
    const terms = queryTerms(
      "a power supply that is quiet enough beside a desk during long sessions"
    );

    expect(terms[0]).toBe("psu");
    expect(terms).toHaveLength(6);
  });

  test("drops words too short to be evidence", () => {
    expect(queryTerms("a pc rig")).toEqual(["rig"]);
  });

  test("returns nothing when the query is all filler", () => {
    // The empty list is what stops an unconstrained query from returning the
    // whole shelf ordered by stock.
    expect(queryTerms("what do you have")).toEqual([]);
  });

  test("resolves a plural category word the embedding model handles worst", () => {
    // "peripherals" names a shelf rather than a thing, so it embeds weakly and
    // the lexical path is the one that has to answer it.
    expect(queryTerms("peripherals for my pc")).toEqual([
      "peripheral",
      "peripherals",
    ]);
    expect(queryTerms("monitors under 20000")).toEqual([
      "monitor",
      "monitors",
      "20000",
    ]);
  });

  test("keeps a query for something the store does not sell intact", () => {
    // "laptop" is a real term; it simply matches no product. Nothing here
    // should quietly rewrite it into something that does.
    expect(queryTerms("i need a laptop for 5000rs")).toEqual([
      "laptop",
      "5000rs",
    ]);
  });
});

describe("canonicalCategory", () => {
  test("maps what a buyer says to what the column stores", () => {
    expect(canonicalCategory("Graphics Card")).toBe("gpu");
    expect(canonicalCategory("power supply")).toBe("psu");
    expect(canonicalCategory("SSD")).toBe("storage");
  });

  test("passes an already-canonical slug through", () => {
    expect(canonicalCategory("gpu")).toBe("gpu");
  });

  test("passes an unrecognised category through untouched", () => {
    // A merchant whose taxonomy is not ours must still be able to filter.
    expect(canonicalCategory("Espresso Machines")).toBe("espresso machines");
  });
});

describe("namesOnlyACategory", () => {
  test("recognises a bare category, so it never reaches the embedding model", () => {
    expect(namesOnlyACategory("gpu")).toBe(true);
    expect(namesOnlyACategory("Graphics Card")).toBe(true);
    expect(namesOnlyACategory("power supplies")).toBe(true);
  });

  test("sends anything with a qualifier to the embedding model", () => {
    // The qualifier is the part only a vector search understands.
    expect(namesOnlyACategory("a quiet power supply")).toBe(false);
    expect(namesOnlyACategory("gpu for 1440p")).toBe(false);
  });
});
