import { describe, expect, test } from "bun:test";
import { blockingIssues, validateBuild } from "../src/index";
import * as f from "./fixtures";

/**
 * The four builds from the plan, end to end.
 *
 * The rule tests prove each check works in isolation. These prove the
 * reduction does not lose anything on the way out — that a blocking finding
 * anywhere reaches `canCheckout`, and that a build with nothing wrong is not
 * confused with a build nothing was checked on.
 */

function rules(issues: { rule: string }[]): string[] {
  return [...new Set(issues.map((issue) => issue.rule))];
}

describe("a good build", () => {
  const result = validateBuild(f.goodBuild);

  test("is compatible", () => {
    expect(result.status).toBe("compatible");
  });

  test("can be checked out", () => {
    expect(result.canCheckout).toBe(true);
    expect(blockingIssues(result)).toHaveLength(0);
  });

  test("reports the checks that passed, not silence", () => {
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.every((issue) => issue.status === "compatible")).toBe(
      true
    );
  });

  test("counts the filled slots", () => {
    expect(result.slotsUsed).toMatchObject({
      cpu: 1,
      gpu: 1,
      motherboard: 1,
      psu: 1,
      ram: 1,
      storage: 1,
    });
  });

  test("estimates the draw and recommends a supply above it", () => {
    expect(result.estimatedWattage).toBe(248);
    expect(result.recommendedPsuWattage).toBeGreaterThan(
      result.estimatedWattage
    );
  });
});

describe("a socket-mismatch build", () => {
  const result = validateBuild(f.socketMismatchBuild);

  test("is incompatible and cannot be checked out", () => {
    expect(result.status).toBe("incompatible");
    expect(result.canCheckout).toBe(false);
  });

  test("names the socket rule", () => {
    expect(rules(blockingIssues(result))).toContain("cpu_motherboard_socket");
  });

  test("still reports the checks that passed", () => {
    expect(result.issues.some((issue) => issue.status === "compatible")).toBe(
      true
    );
  });
});

describe("an oversized-GPU build", () => {
  const result = validateBuild(f.oversizedGpuBuild);

  test("is incompatible and cannot be checked out", () => {
    expect(result.status).toBe("incompatible");
    expect(result.canCheckout).toBe(false);
  });

  test("names the clearance rule", () => {
    expect(rules(blockingIssues(result))).toContain("gpu_case_clearance");
  });

  test("says how short the case is", () => {
    const issue = result.issues.find(
      (entry) => entry.rule === "gpu_case_clearance"
    );

    expect(issue?.message).toContain("358mm");
    expect(issue?.message).toContain("300mm");
  });
});

describe("a build with missing specs", () => {
  const result = validateBuild(f.missingSpecsBuild);

  test("is insufficient_data, never compatible", () => {
    expect(result.status).toBe("insufficient_data");
  });

  test("does not block the checkout on unknowns alone", () => {
    expect(result.canCheckout).toBe(true);
  });

  test("names every column it could not read", () => {
    const missing = result.issues.flatMap((issue) => issue.missingSpecs ?? []);

    expect(missing).toContain("Unspecified Processor.socket");
    expect(missing).toContain("Intel Arc A750 (imported).lengthMm");
    expect(missing).toContain("Intel Arc A750 (imported).pciePowerConnectors");
  });

  test("an unknown draw is not treated as zero draw", () => {
    const headroom = result.issues.find(
      (issue) => issue.rule === "psu_wattage_headroom"
    );

    expect(headroom?.status).toBe("insufficient_data");
  });
});

describe("an unfinished build", () => {
  const result = validateBuild([f.ryzen7600, f.b650mPlus]);

  test("cannot be checked out", () => {
    expect(result.canCheckout).toBe(false);
  });

  test("says what is still needed rather than what is wrong", () => {
    const issue = result.issues.find(
      (entry) => entry.rule === "build_completeness"
    );

    expect(issue?.message).toContain("memory");
    expect(issue?.message).toContain("power supplies");
    expect(issue?.message).toContain("cases");
  });

  test("an empty build is unfinished, not compatible", () => {
    expect(validateBuild([]).canCheckout).toBe(false);
  });
});

describe("optional slots", () => {
  test("a build with integrated graphics and no card is complete", () => {
    const result = validateBuild([
      f.ryzen7600,
      f.b650mPlus,
      f.ddr5Kit16,
      f.nvme1tb,
      f.psu650,
      f.caseCh370,
    ]);

    expect(result.canCheckout).toBe(true);
    expect(result.slotsUsed.gpu).toBe(0);
  });

  test("two processors is one too many", () => {
    const result = validateBuild([...f.goodBuild, f.ryzen7900x]);

    expect(result.canCheckout).toBe(false);
    expect(rules(blockingIssues(result))).toContain("build_completeness");
  });
});
