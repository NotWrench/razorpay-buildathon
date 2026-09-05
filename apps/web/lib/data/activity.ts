import { agentDb, auditLogs, db, failures, orders } from "@workspace/db";
import { desc, eq, inArray } from "drizzle-orm";
import { cache } from "react";
import { managerStoreId } from "@/lib/manager-store";
import { orderRef } from "./account";
import type { ActivityEntry } from "./types";

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
      /** Set when the entry records something that did not work. */
      failed:
        row.action.includes("FAILED") ||
        row.action.includes("BREACHED") ||
        row.action.includes("DENIED"),
      explanation: row.explanation,
      id: row.id,
      orderRef:
        row.orderId && ownedIds.has(row.orderId)
          ? orderRef(row.orderId)
          : null,
      /*
       * The flag that separates "while I was asleep" from "because I asked".
       * It is the first thing a merchant wants to know about an agent action.
       */
      scheduled:
        (row.metadata as { scheduled?: boolean } | null)?.scheduled === true,
      failureType: row.orderId
        ? (failureByOrder.get(row.orderId) ?? null)
        : null,
    }));
  }
);
