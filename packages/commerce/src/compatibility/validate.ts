import { worstStatus } from "./helpers";
import { slotsUsed } from "./rules/completeness";
import { RULES } from "./rules/index";
import { estimateWattage, recommendPsuWattage } from "./rules/power";
import type { BuildComponent, BuildValidation } from "./types";

/**
 * Run every rule over a build and reduce the findings to one answer.
 *
 * The reduction is where §4's guarantee actually lives, so it is deliberately
 * dull: the status is the worst of the findings, and `canCheckout` is false if
 * and only if something is `blocking`. Neither is a judgement call the model
 * gets to make — by the time a result reaches the agent it has already been
 * decided, and the agent's job is to explain it.
 *
 * Passing checks are returned alongside failing ones. A build that clears
 * every rule would otherwise produce an empty result, which reads the same as
 * a build nothing was checked on, and those are very different things to tell
 * a customer.
 */
export function validateBuild(components: BuildComponent[]): BuildValidation {
  const issues = RULES.flatMap((rule) => rule.run(components));
  const estimate = estimateWattage(components);

  return {
    canCheckout: !issues.some((entry) => entry.severity === "blocking"),
    estimatedWattage: estimate.watts,
    issues,
    recommendedPsuWattage: recommendPsuWattage(components),
    slotsUsed: slotsUsed(components),
    status: worstStatus(issues.map((entry) => entry.status)),
  };
}

/** Only the findings that stop a checkout, in the order the rules ran. */
export function blockingIssues(validation: BuildValidation) {
  return validation.issues.filter((entry) => entry.severity === "blocking");
}
