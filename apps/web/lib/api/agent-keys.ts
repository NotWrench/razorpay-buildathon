import "server-only";

import { auth } from "@workspace/auth";
import { type ApiKeyMetadata, apikey, db, orders } from "@workspace/db";
import { and, count, desc, eq, inArray, sum } from "drizzle-orm";

/**
 * The keys a merchant has issued to buying agents.
 *
 * `.well-known/agent-commerce.json` has always told counterparties to "issue a
 * key from the merchant dashboard". There was no such thing. This is it, and
 * it is deliberately more than a token generator: a key carries the store it
 * may trade with and the total that store is willing to let it commit, so the
 * bounds the manifest publishes are the merchant's own rather than the
 * platform's defaults.
 *
 * The secret is returned exactly once, on creation, and never stored anywhere
 * we can read it back. A screen that can re-display a key is a screen that
 * leaks every key it has ever issued the moment anybody gets to it.
 */

export interface AgentKeySummary {
  createdAt: Date;
  id: string;
  label: string;
  /** Orders this key has placed, and what they came to. */
  orders: { approved: number; pending: number; rejected: number; total: number };
  /** Masked. The secret itself is unrecoverable by design. */
  prefix: string;
  revoked: boolean;
  spendCapPaise: number | null;
  spentPaise: number;
}

function metadataOf(row: { metadata: ApiKeyMetadata | null }): ApiKeyMetadata {
  return row.metadata ?? {};
}

/** First and last few characters. Enough to recognise, useless to replay. */
function mask(id: string): string {
  return `${id.slice(0, 6)}${"•".repeat(10)}${id.slice(-4)}`;
}

/**
 * Every key issued for this store, with what it has actually bought.
 *
 * Scoped by the `merchantId` written into the key's metadata rather than by
 * the issuing user, so a merchant sees the keys that can trade with *their*
 * store — which is the question the screen is answering.
 */
export async function listAgentKeys(
  merchantId: string
): Promise<AgentKeySummary[]> {
  const rows = await db.select().from(apikey).orderBy(desc(apikey.createdAt));

  const mine = rows.filter(
    (row) => metadataOf(row).merchantId === merchantId
  );

  if (mine.length === 0) {
    return [];
  }

  const ids = mine.map((row) => row.id);

  /*
   * Orders are keyed on `buyerIdentifier`, which for an API-key caller is the
   * key's id — see `resolveActor`. So the join is a string match, not a
   * foreign key, and it is written here rather than assumed at the call site.
   */
  const activity = await db
    .select({
      approvalStatus: orders.approvalStatus,
      buyerIdentifier: orders.buyerIdentifier,
      orders: count(orders.id),
      total: sum(orders.totalAmount),
    })
    .from(orders)
    .where(
      and(
        eq(orders.merchantId, merchantId),
        inArray(orders.buyerIdentifier, ids)
      )
    )
    .groupBy(orders.buyerIdentifier, orders.approvalStatus);

  return mine.map((row) => {
    const meta = metadataOf(row);
    const rows_ = activity.filter((entry) => entry.buyerIdentifier === row.id);

    const countFor = (status: string) =>
      rows_
        .filter((entry) => entry.approvalStatus === status)
        .reduce((sum_, entry) => sum_ + Number(entry.orders), 0);

    return {
      createdAt: row.createdAt,
      id: row.id,
      label: meta.label ?? row.name ?? "Unnamed agent",
      orders: {
        approved: countFor("approved"),
        pending: countFor("pending_approval"),
        rejected: countFor("rejected"),
        total: rows_.reduce((sum_, entry) => sum_ + Number(entry.orders), 0),
      },
      prefix: mask(row.id),
      revoked: !row.enabled,
      spendCapPaise: meta.spendCapPaise ?? null,
      // Only what was actually approved. A rejected order committed nothing,
      // and counting it would make a key look spent when it is untouched.
      spentPaise: rows_
        .filter((entry) => entry.approvalStatus === "approved")
        .reduce((sum_, entry) => sum_ + Number(entry.total ?? 0), 0),
    };
  });
}

export interface IssuedAgentKey {
  id: string;
  /** Shown once. Never retrievable again. */
  key: string;
}

export async function issueAgentKey(input: {
  label: string;
  merchantId: string;
  /** Null for "use the platform default". */
  spendCapPaise: number | null;
  userId: string;
}): Promise<IssuedAgentKey> {
  const created = await auth.api.createApiKey({
    body: {
      metadata: {
        label: input.label,
        merchantId: input.merchantId,
        spendCapPaise: input.spendCapPaise ?? undefined,
      } satisfies ApiKeyMetadata,
      name: input.label,
      userId: input.userId,
    },
  });

  return { id: created.id, key: created.key };
}

/**
 * Revokes a key, checking it belongs to this store first.
 *
 * Disabled rather than deleted: the orders it placed still name it, and a
 * merchant asking "what did that agent buy before I cut it off" should get an
 * answer rather than an unresolvable id.
 */
export async function revokeAgentKey(input: {
  keyId: string;
  merchantId: string;
}): Promise<boolean> {
  const row = await db.query.apikey.findFirst({
    where: eq(apikey.id, input.keyId),
  });

  if (!row || metadataOf(row).merchantId !== input.merchantId) {
    return false;
  }

  await db
    .update(apikey)
    .set({ enabled: false })
    .where(eq(apikey.id, input.keyId));

  return true;
}
