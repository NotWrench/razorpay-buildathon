import { describe, expect, test } from "bun:test";
import { describeAttributeChange } from "../src/build-upgrades";

/**
 * Whether one part's stated attribute is actually better than another's.
 *
 * This decides what the agent offers to sell somebody. Comparing the values as
 * strings — which is what this did until a probe caught it — says a 12GB card
 * improves on a 16GB one because the text differs, and the assembler offers
 * ₹15,000 for less memory with "12GB GDDR6X instead of 16GB GDDR6" attached.
 * That is the worst shape a wrong answer can take: confident, specific, and
 * quoting the real numbers back at the buyer.
 */

describe("describeAttributeChange", () => {
  test("offers more of a numeric attribute", () => {
    expect(describeAttributeChange("8GB GDDR6", "16GB GDDR6")).toBe(
      "16GB GDDR6 instead of 8GB GDDR6"
    );
  });

  test("refuses less of a numeric attribute", () => {
    /* The bug. Different text, worse part, ₹15,000 more. */
    expect(describeAttributeChange("16GB GDDR6", "12GB GDDR6X")).toBeNull();
  });

  test("refuses the same amount in different words", () => {
    expect(describeAttributeChange("16GB GDDR6", "16GB GDDR6X")).toBeNull();
  });

  test("reads the number a core count leads with", () => {
    expect(describeAttributeChange("10C/16T", "14C/20T")).toBe(
      "14C/20T instead of 10C/16T"
    );
  });

  test("refuses fewer cores", () => {
    expect(describeAttributeChange("14C/20T", "10C/16T")).toBeNull();
  });

  test("falls back to difference when neither leads with a number", () => {
    /*
     * All this data supports for a non-numeric attribute. The offer still has
     * to clear the price and compatibility checks in `upgradeFor` to be made.
     */
    expect(describeAttributeChange("Air", "Liquid")).toBe(
      "Liquid instead of Air"
    );
  });

  test("says nothing when the value did not change", () => {
    expect(describeAttributeChange("16GB", "16GB")).toBeNull();
  });

  test("says nothing when either side is missing", () => {
    expect(describeAttributeChange(null, "16GB")).toBeNull();
    expect(describeAttributeChange("16GB", null)).toBeNull();
  });

  test("handles a decimal", () => {
    expect(describeAttributeChange("1.5GHz", "2.5GHz")).toBe(
      "2.5GHz instead of 1.5GHz"
    );
    expect(describeAttributeChange("2.5GHz", "1.5GHz")).toBeNull();
  });
});
