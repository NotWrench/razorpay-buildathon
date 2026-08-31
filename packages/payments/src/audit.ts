import { auditLogs, db, failures } from "@workspace/db";

export type AuditActorType =
  | "human_buyer"
  | "merchant"
  | "ai_assistant"
  | "external_ai_agent"
  | "system";

/**
 * Appends an explainable audit entry. Auditing must never break a payment
 * flow, so write errors are swallowed after being logged.
 */
export async function recordAudit(entry: {
  action: string;
  actorId: string;
  actorType: AuditActorType;
  explanation: string;
  merchantId: string;
  metadata?: Record<string, unknown>;
  orderId?: string | null;
}): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      action: entry.action,
      actorId: entry.actorId,
      actorType: entry.actorType,
      explanation: entry.explanation,
      merchantId: entry.merchantId,
      metadata: entry.metadata,
      orderId: entry.orderId ?? null,
    });
  } catch (error) {
    console.error("Failed to write audit log", error);
  }
}

/** Records a recoverable failure (declined payment, stock-out, ...). */
export async function recordFailure(entry: {
  errorMessage: string;
  errorType: string;
  orderId?: string | null;
  recoveryAction?: string | null;
}): Promise<void> {
  try {
    await db.insert(failures).values({
      errorMessage: entry.errorMessage,
      errorType: entry.errorType,
      orderId: entry.orderId ?? null,
      recoveryAction: entry.recoveryAction ?? null,
    });
  } catch (error) {
    console.error("Failed to write failure log", error);
  }
}
