import { describe, expect, test } from "bun:test";
import { resolvePins } from "../src/build-pins";
import type { Candidate } from "../src/build-upgrades";
import type { CategorySlug } from "@workspace/db/taxonomy";

/**
 * Resolving the part a buyer named to a row the store stocks.
 *
 * "Build me a PC with an RTX 5090" answered with an RTX 4060 and said nothing
 * about it — the assembler chose every slot from a share of the budget, so the
 * named part had no way to reach the machine at all. These tests cover the two
 * halves of the fix that can go wrong quietly: landing on the row the buyer
 * meant, and refusing to land on one they did not.
 */

function candidate(
  name: string,
  category: CategorySlug,
  price: number,
  extra: { brand?: string; sku?: string } = {}
): Candidate {
  return {
    attributes: null,
    category,
    lowStockThreshold: null,
    product: {
      brand: extra.brand ?? null,
      id: name,
      name,
      price,
      sku: extra.sku ?? null,
    } as Candidate["product"],
    specs: null,
  };
}

const FLAGSHIP = candidate(
  "NVIDIA GeForce RTX 5090 Founders Edition",
  "gpu",
  18_999_900,
  { brand: "NVIDIA", sku: "GPU-NV-5090-FE" }
);
const TI = candidate(
  "Zotac Gaming GeForce RTX 5070 Ti Solid",
  "gpu",
  7_999_900
);
const PLAIN = candidate("ASUS Dual GeForce RTX 5070", "gpu", 5_999_900);
const RADEON = candidate("PowerColor Hellhound RX 7800 XT", "gpu", 4_999_900);
const CHIP = candidate("AMD Ryzen 7 7800X3D", "cpu", 3_499_900);
/* Names the 5090 in its description, which is why descriptions are not read. */
const SUPPLY = candidate(
  "Seasonic Vertex GX-1200 1200W Gold",
  "psu",
  2_399_900
);

const STOCKED = [FLAGSHIP, TI, PLAIN, RADEON, CHIP, SUPPLY];

describe("resolvePins", () => {
  test("pins the card the buyer named", () => {
    const { pinned, unmatched } = resolvePins(STOCKED, [], ["RTX 5090"]);

    expect(unmatched).toEqual([]);
    expect(pinned.get("gpu")?.candidate).toBe(FLAGSHIP);
  });

  test("survives the words around the part", () => {
    const { pinned } = resolvePins(STOCKED, [], ["an RTX 5090 graphics card"]);

    expect(pinned.get("gpu")?.candidate).toBe(FLAGSHIP);
  });

  test("resolves a SKU", () => {
    const { pinned } = resolvePins(STOCKED, [], ["GPU-NV-5090-FE"]);

    expect(pinned.get("gpu")?.candidate).toBe(FLAGSHIP);
  });

  test("takes the tightest match, not the dearest", () => {
    /* "RTX 5070" is a prefix of the 5070 Ti's name. It is not what was asked. */
    const { pinned } = resolvePins(STOCKED, [], ["RTX 5070"]);

    expect(pinned.get("gpu")?.candidate).toBe(PLAIN);
  });

  test("pins the Ti when the Ti is what was said", () => {
    const { pinned } = resolvePins(STOCKED, [], ["RTX 5070 Ti"]);

    expect(pinned.get("gpu")?.candidate).toBe(TI);
  });

  test("never lands on a near miss", () => {
    /* The failure this file exists to stop: a silent substitution. */
    const { pinned, unmatched } = resolvePins(STOCKED, [], ["RTX 4090"]);

    expect(pinned.size).toBe(0);
    expect(unmatched).toEqual([{ reason: "not-stocked", request: "RTX 4090" }]);
  });

  test("does not read the description, where other parts are name-dropped", () => {
    /* The 1200W supply's copy says "GPUs like the RTX 5090". It is not one. */
    const { pinned } = resolvePins([SUPPLY, FLAGSHIP], [], ["RTX 5090"]);

    expect(pinned.get("gpu")?.candidate).toBe(FLAGSHIP);
    expect(pinned.has("psu")).toBe(false);
  });

  test("says sold out rather than not sold", () => {
    const { pinned, unmatched } = resolvePins([CHIP], [FLAGSHIP], ["RTX 5090"]);

    expect(pinned.size).toBe(0);
    expect(unmatched).toEqual([
      {
        match: "NVIDIA GeForce RTX 5090 Founders Edition",
        reason: "out-of-stock",
        request: "RTX 5090",
      },
    ]);
  });

  test("takes one part per slot and names the collision", () => {
    const { pinned, unmatched } = resolvePins(
      STOCKED,
      [],
      ["RTX 5090", "RX 7800 XT"]
    );

    expect(pinned.get("gpu")?.candidate).toBe(FLAGSHIP);
    expect(unmatched).toEqual([
      {
        match: "NVIDIA GeForce RTX 5090 Founders Edition",
        reason: "slot-taken",
        request: "RX 7800 XT",
        slug: "gpu",
      },
    ]);
  });

  test("pins parts in different slots together", () => {
    const { pinned, unmatched } = resolvePins(
      STOCKED,
      [],
      ["RTX 5090", "Ryzen 7 7800X3D"]
    );

    expect(unmatched).toEqual([]);
    expect(pinned.get("gpu")?.candidate).toBe(FLAGSHIP);
    expect(pinned.get("cpu")?.candidate).toBe(CHIP);
  });

  test("carries the buyer's own words back", () => {
    const { pinned } = resolvePins(STOCKED, [], ["a 5090"]);

    expect(pinned.get("gpu")?.request).toBe("a 5090");
  });
});
