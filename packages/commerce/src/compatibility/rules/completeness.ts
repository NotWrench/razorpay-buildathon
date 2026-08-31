import { CATEGORY_DEFINITIONS } from "@workspace/db/taxonomy";
import { issue } from "../helpers";
import type { BuildComponent, CompatibilityIssue } from "../types";

/**
 * Whether the build is a whole computer.
 *
 * Every other rule asks whether two chosen parts get along. This one asks
 * whether enough parts have been chosen at all, and it is the reason a
 * half-finished build cannot be checked out: the shortfall is `blocking`, but
 * only in the sense that a draft is not yet an order. Nothing here is wrong,
 * it is merely unfinished.
 *
 * What counts as required comes from the taxonomy rather than a list here, so
 * the seed, the storefront and this rule cannot drift apart. A graphics card
 * and a cooler are optional there on purpose — integrated graphics is a real
 * build, and many processors ship with a cooler.
 */

/** How many units occupy each build slot. */
export function slotsUsed(
  components: BuildComponent[]
): Record<string, number> {
  const used: Record<string, number> = {};

  for (const definition of CATEGORY_DEFINITIONS) {
    if (!definition.buildSlot) {
      continue;
    }

    used[definition.buildSlot] = components
      .filter((component) => component.categorySlug === definition.slug)
      .reduce((total, component) => total + component.quantity, 0);
  }

  return used;
}

export function buildCompleteness(
  components: BuildComponent[]
): CompatibilityIssue[] {
  const used = slotsUsed(components);
  const issues: CompatibilityIssue[] = [];
  const missing: string[] = [];

  for (const definition of CATEGORY_DEFINITIONS) {
    if (!definition.buildSlot) {
      continue;
    }

    const count = used[definition.buildSlot] ?? 0;

    if (count < definition.minPerBuild) {
      missing.push(definition.name.toLowerCase());
      continue;
    }

    if (definition.maxPerBuild !== null && count > definition.maxPerBuild) {
      issues.push(
        issue({
          affectedProductIds: components
            .filter((component) => component.categorySlug === definition.slug)
            .map((component) => component.productId),
          message: `This build has ${count} in the ${definition.buildSlot} slot and takes at most ${definition.maxPerBuild}.`,
          rule: "build_completeness",
          status: "incompatible",
          suggestion: `Remove ${count - definition.maxPerBuild} and keep the rest.`,
        })
      );
    }
  }

  if (missing.length > 0) {
    issues.push(
      issue({
        affectedProductIds: [],
        message: `This build is not complete yet — it still needs ${missing.join(", ")}.`,
        rule: "build_completeness",
        status: "incompatible",
        suggestion: "Fill the remaining slots before checking out.",
      })
    );

    return issues;
  }

  issues.push(
    issue({
      affectedProductIds: [],
      message: "Every part a working build needs has been chosen.",
      rule: "build_completeness",
      status: "compatible",
    })
  );

  return issues;
}
