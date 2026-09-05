/**
 * Re-exported from `@workspace/payments`, which owns the one definition.
 *
 * These used to live here. They moved when `mandate-policy.ts` needed to put a
 * rupee amount in a refusal a buyer reads and could not import the agent layer
 * — the same dependency direction that decided where the approval policy and
 * the mandate rule live. Every caller in this package keeps its import.
 */
export {
  formatPaise,
  paiseToRupees,
  percentageOff,
  rupeesToPaise,
} from "@workspace/payments";
