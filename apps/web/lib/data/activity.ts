import { agentDb, auditLogs, db, failures, orders } from "@workspace/db";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { cache } from "react";
import { managerStoreId } from "@/lib/manager-store";
import { orderRef } from "./account";
import type { ActivityEntry, OrderTrail } from "./types";

/**
 * Everything that happened to this store, human and agent in one stream.
 *
 * The brief asks for the audit trail to be *shown*, and until now it was only
 * readable through the assistant — you had to ask the agent what the agent had
 * been doing, which is the one source you would want to check it against.
 *
 * Human and agent actions are deliberately not separated into two feeds. The
 * question a merchant actually has is "who changed this price", and an
 * interface that makes them look in two places to find out teaches them that
 * the two kinds of action are different in some way that matters. They are
 * not: an approval is an approval whoever pressed it, and the actor column
 * says which.
 *
 * Failures are folded into the same stream. A refund Razorpay refused belongs
 * next to the refund that worked, not in a separate log nobody opens.
 */

const WHEN = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
});

/** Turns AUDIT_ACTION_NAMES into "Audit action names". */
function humanize(action: string): string {
  const words = action.toLowerCase().replace(/_/g, " ");

  return words.charAt(0).toUpperCase() + words.slice(1);
}

const ACTOR_WORD: Record<string, string> = {
  ai_assistant: "Assistant",
  external_ai_agent: "Buying agent",
  human_buyer: "Shopper",
  merchant: "You",
  system: "System",
};

export const getActivity = cache(
  async (limit = 120): Promise<ActivityEntry[]> => {
    const merchantId = await managerStoreId();

    const rows = await agentDb
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.merchantId, merchantId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);

    if (rows.length === 0) {
      return [];
    }

    const orderIds = [
      ...new Set(rows.map((row) => row.orderId).filter(Boolean)),
    ] as string[];

    /*
     * The order ids are checked against this merchant's own orders before any
     * reference is rendered. `audit_logs` lives in the agent database and
     * cannot have a foreign key to `orders`, so an id in that column is a
     * claim rather than a guarantee.
     */
    const owned =
      orderIds.length === 0
        ? []
        : await db
            .select({ id: orders.id })
            .from(orders)
            .where(inArray(orders.id, orderIds));

    const ownedIds = new Set(owned.map((row) => row.id));

    const failed =
      orderIds.length === 0
        ? []
        : await agentDb
            .select()
            .from(failures)
            .where(inArray(failures.orderId, orderIds));

    const failureByOrder = new Map(
      failed.map((row) => [row.orderId ?? "", row.errorType])
    );

    return rows.map((row) => ({
      action: humanize(row.action),
      actor: ACTOR_WORD[row.actorType] ?? row.actorType,
      at: WHEN.format(row.createdAt),
      explanation: row.explanation,
      /** Set when the entry records something that did not work. */
      failed:
        row.action.includes("FAILED") ||
        row.action.includes("BREACHED") ||
        row.action.includes("DENIED") ||
        // A mandate that would not stretch is a refusal, and the merchant's
        // "did not work" filter is where somebody looks for it.
        row.action.includes("REFUSED"),
      failureType: row.orderId
        ? (failureByOrder.get(row.orderId) ?? null)
        : null,
      id: row.id,
      orderRef:
        row.orderId && ownedIds.has(row.orderId) ? orderRef(row.orderId) : null,
      /*
       * The flag that separates "while I was asleep" from "because I asked".
       * It is the first thing a merchant wants to know about an agent action.
       */
      scheduled:
        (row.metadata as { scheduled?: boolean } | null)?.scheduled === true,
    }));
  }
);

/**
 * Everything recorded against one order, oldest first.
 *
 * `GET /api/agent/trace/{orderId}` has served this since the audit trail
 * existed and nothing on any screen ever called it, so the most complete
 * explainability record in the system was reachable only by typing a URL. This
 * is the same read, for a page that has already established the caller may see
 * the order.
 *
 * It is a query rather than a fetch of our own endpoint on purpose. The pages
 * that use it are server components which have already loaded and authorised
 * the order; going back out over HTTP would re-do that work and re-do the
 * authorisation to reach the same rows. The endpoint stays for callers who are
 * not us.
 *
 * **Authorisation is the caller's job here.** Nothing below checks who is
 * asking — both call sites resolve the order first, one against the buyer and
 * one against the merchant. A third call site must do the same.
 */
export async function getOrderTrail(orderId: string): Promise<OrderTrail> {
  const [rows, failureRows] = await Promise.all([
    agentDb
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.orderId, orderId))
      .orderBy(asc(auditLogs.createdAt)),
    agentDb
      .select()
      .from(failures)
      .where(eq(failures.orderId, orderId))
      .orderBy(asc(failures.createdAt)),
  ]);

  return {
    entries: rows.map((row) => ({
      action: humanize(row.action),
      actor: ACTOR_WORD[row.actorType] ?? row.actorType,
      at: WHEN.format(row.createdAt),
      explanation: row.explanation,
      failed:
        row.action.includes("FAILED") ||
        row.action.includes("BREACHED") ||
        row.action.includes("DENIED"),
      id: row.id,
      scheduled:
        (row.metadata as { scheduled?: boolean } | null)?.scheduled === true,
    })),
    failures: failureRows.map((row) => ({
      at: WHEN.format(row.createdAt),
      id: row.id,
      message: row.errorMessage,
      /* Shown beside the failure rather than in its own list: a refund
         Razorpay refused and the retry link that followed are one event to
         anyone reading this, not two. */
      recovery: row.recoveryAction ? humanize(row.recoveryAction) : null,
      type: humanize(row.errorType),
    })),
  };
}
