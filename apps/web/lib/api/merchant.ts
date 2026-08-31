import { db, merchants } from "@workspace/db";
import { PaymentError } from "@workspace/payments";
import { and, eq } from "drizzle-orm";
import type { Actor } from "./actor";

/** True when the actor is the signed-in owner of the merchant. */
export async function isMerchantOwner(
  actor: Actor,
  merchantId: string
): Promise<boolean> {
  if (actor.type !== "human" || !actor.userId) {
    return false;
  }

  const merchant = await db.query.merchants.findFirst({
    where: and(
      eq(merchants.id, merchantId),
      eq(merchants.userId, actor.userId)
    ),
  });

  return Boolean(merchant);
}

/**
 * Guards merchant-only actions (approve, reject, refund, capture).
 *
 * API-key callers are buyers, never merchants, so they are rejected outright.
 */
export async function assertMerchantOwner(
  actor: Actor,
  merchantId: string
): Promise<void> {
  if (!(await isMerchantOwner(actor, merchantId))) {
    throw new PaymentError(
      "MERCHANT_NOT_FOUND",
      "You do not own the merchant this order belongs to"
    );
  }
}
