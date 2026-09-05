export { recordAudit, recordFailure } from "@workspace/payments";

/**
 * Canonical audit actions written by the AI layer.
 *
 * These sit alongside the actions `@workspace/payments` already writes
 * (`ORDER_CREATED`, `ORDER_APPROVED`, `RAZORPAY_ORDER_CREATED`,
 * `ORDER_REJECTED`, `PAYMENT_LINK_CREATED`, ...). Keeping them as constants
 * means the audit timeline can group and label them without string drift.
 */
export const AuditAction = {
  AGENT_ORDER_REQUESTED: "AGENT_ORDER_REQUESTED",
  AGENT_QUOTED: "AGENT_QUOTED",
  AGENT_RECOMMENDED: "AGENT_RECOMMENDED",
  AGENT_SEARCH: "AGENT_SEARCH",
  APPROVAL_DENIED: "APPROVAL_DENIED",
  APPROVAL_GRANTED: "APPROVAL_GRANTED",
  APPROVAL_REQUESTED: "APPROVAL_REQUESTED",
  BUDGET_CHECK_FAILED: "BUDGET_CHECK_FAILED",
  BRIEFING_RUN: "BRIEFING_RUN",
  CAMPAIGN_APPROVED: "CAMPAIGN_APPROVED",
  CAMPAIGN_DRAFTED: "CAMPAIGN_DRAFTED",
  CONVERSATION_STARTED: "CONVERSATION_STARTED",
  CAMPAIGN_EXPIRED: "CAMPAIGN_EXPIRED",
  CAMPAIGN_PAUSED: "CAMPAIGN_PAUSED",
  CAMPAIGN_REJECTED: "CAMPAIGN_REJECTED",
  INVENTORY_THRESHOLD_UPDATED: "INVENTORY_THRESHOLD_UPDATED",
  MARGIN_FLOOR_BREACHED: "MARGIN_FLOOR_BREACHED",
  MEMORY_WRITTEN: "MEMORY_WRITTEN",
  ORDER_CANCELLED: "ORDER_CANCELLED",
  PRICE_CHANGED: "PRICE_CHANGED",
  PRODUCT_CREATED: "PRODUCT_CREATED",
  PRODUCT_DEACTIVATED: "PRODUCT_DEACTIVATED",
  PRODUCT_ENRICHED: "PRODUCT_ENRICHED",
  PRODUCT_UPDATED: "PRODUCT_UPDATED",
  REFUND_FAILED: "REFUND_FAILED",
  REFUND_ISSUED: "REFUND_ISSUED",
  REORDER_APPROVED: "REORDER_APPROVED",
  REORDER_ORDERED: "REORDER_ORDERED",
  REORDER_REJECTED: "REORDER_REJECTED",
  REORDER_REQUESTED: "REORDER_REQUESTED",
  SEARCH_GUARDRAIL_BLOCKED: "SEARCH_GUARDRAIL_BLOCKED",
  STORE_RENAMED: "STORE_RENAMED",
  WEB_SEARCH: "WEB_SEARCH",
} as const;

export type AuditActionName = (typeof AuditAction)[keyof typeof AuditAction];

/** Recovery actions written to `failures.recovery_action`. */
export const RecoveryAction = {
  CANCELLED_BY_BUYER: "CANCELLED_BY_BUYER",
  DOWNGRADED_CART: "DOWNGRADED_CART",
  RETRY_LINK_GENERATED: "RETRY_LINK_GENERATED",
} as const;

/** Maps an actor onto the audit log's actor taxonomy. */
export function auditActorType(
  type: "human" | "ai_agent",
  surface: "storefront" | "merchant" = "storefront"
): "human_buyer" | "merchant" | "ai_assistant" | "external_ai_agent" {
  if (type === "ai_agent") {
    return "external_ai_agent";
  }

  return surface === "merchant" ? "merchant" : "human_buyer";
}
