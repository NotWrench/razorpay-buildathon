"use server";

import { AuditAction, recordAudit } from "@workspace/ai";
import {
  db,
  inventory,
  merchants,
  orders,
  payments,
  products,
  reorderRequests,
} from "@workspace/db";
import {
  approveOrder,
  recordFailure,
  refundPayment,
  rejectOrder,
  toPaymentError,
} from "@workspace/payments";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { managerActor, managerStoreId } from "@/lib/manager-store";
import { type ActionResult, failed, ok } from "./result";

/**
 * The manager's writes.
 *
 * Until now every control in the manager's room was a `toast()`: approving a
 * reorder changed nothing, refunding an order changed nothing, removing a
 * product changed nothing but the screen. The buttons lied, and a merchant who
 * finds that out once stops believing the honest ones too.
 *
 * Three rules hold for everything below.
 *
 * **The store is resolved from who is asking, never from an argument.** Every
 * action calls `managerStoreId()` and then scopes its query to it, so an id
 * posted from a browser can only ever address a row in the caller's own store.
 * A row that does not match comes back as a refusal, not a 500 — and never as
 * a message confirming the row exists somewhere else.
 *
 * **Every write is audited.** Same table the agent writes to, so the merchant
 * reads one trail rather than two, and "who took this product off sale" has an
 * answer whichever of them did it.
 *
 * **A failure is a value, not a throw.** A thrown error reaches the client as
 * an opaque digest, which tells a merchant watching a refund fail precisely
 * nothing. See `result.ts`.
 */

const MANAGER_PATHS = [
  "/manager",
  "/manager/orders",
  "/manager/products",
  "/manager/restock",
] as const;

function revalidateManager(): void {
  for (const path of MANAGER_PATHS) {
    revalidatePath(path);
  }
}

/* -------------------------------------------------------------------- store */

/**
 * Renames the store.
 *
 * The only editable thing on the account screen, and deliberately so. The slug
 * is in the storefront's URLs, in `catalog.json` and in the discovery manifest
 * a buying agent may already have cached, so changing it here would break
 * counterparties silently; the currency is stamped on every order ever placed.
 * Both are shown, neither is a form field pretending otherwise.
 */
export async function renameStoreAction(name: string): Promise<ActionResult> {
  const { actorId, merchantId } = await managerActor();
  const trimmed = name.trim();

  if (trimmed.length < 2) {
    return failed("A store needs a name.");
  }

  const [before] = await db
    .select({ businessName: merchants.businessName })
    .from(merchants)
    .where(eq(merchants.id, merchantId));

  await db
    .update(merchants)
    .set({ businessName: trimmed })
    .where(eq(merchants.id, merchantId));

  await recordAudit({
    action: AuditAction.STORE_RENAMED,
    actorId,
    actorType: "merchant",
    explanation: `Renamed the store from "${before?.businessName ?? "?"}" to "${trimmed}".`,
    merchantId,
  });

  revalidatePath("/manager/account");

  return ok();
}

/* ------------------------------------------------------------------ restock */

/**
 * Approves a reorder request the assistant (or a person) raised.
 *
 * Approving buys nothing. It records that a human agreed with the request,
 * which is the decision `reorder_requests` exists to hold — placing it with a
 * supplier is a step this system does not model and should not pretend to.
 */
export async function approveRestockAction(
  reorderRequestId: string
): Promise<ActionResult> {
  const { actorId, merchantId } = await managerActor();

  const request = await db.query.reorderRequests.findFirst({
    where: and(
      eq(reorderRequests.id, reorderRequestId),
      eq(reorderRequests.merchantId, merchantId)
    ),
  });

  if (!request) {
    return failed("That request is not in this store.");
  }

  if (request.status !== "draft") {
    return failed(`That request is already ${request.status}.`);
  }

  await db
    .update(reorderRequests)
    .set({ approvedAt: new Date(), approvedBy: actorId, status: "approved" })
    .where(eq(reorderRequests.id, reorderRequestId));

  await recordAudit({
    action: AuditAction.REORDER_APPROVED,
    actorId,
    actorType: "merchant",
    explanation: `Approved a reorder of ${request.quantity} unit(s). The request read: ${request.reason}`,
    merchantId,
    metadata: {
      productId: request.productId,
      quantity: request.quantity,
      raisedByAgent: request.createdByAgent,
      reorderRequestId,
    },
  });

  revalidateManager();

  return ok();
}

export async function rejectRestockAction(
  reorderRequestId: string,
  reason?: string
): Promise<ActionResult> {
  const { actorId, merchantId } = await managerActor();

  const request = await db.query.reorderRequests.findFirst({
    where: and(
      eq(reorderRequests.id, reorderRequestId),
      eq(reorderRequests.merchantId, merchantId)
    ),
  });

  if (!request) {
    return failed("That request is not in this store.");
  }

  await db
    .update(reorderRequests)
    .set({ status: "cancelled" })
    .where(eq(reorderRequests.id, reorderRequestId));

  await recordAudit({
    action: AuditAction.REORDER_REJECTED,
    actorId,
    actorType: "merchant",
    /*
     * A rejection with no stated reason is recorded as exactly that. Inventing
     * "rejected by merchant" as the explanation would make the trail read as
     * though a reason had been given.
     */
    explanation: reason?.trim()
      ? `Rejected a reorder of ${request.quantity} unit(s): ${reason.trim()}`
      : `Rejected a reorder of ${request.quantity} unit(s). No reason given.`,
    merchantId,
    metadata: { productId: request.productId, reorderRequestId },
  });

  revalidateManager();

  return ok();
}

/** Sets the thresholds a product's low-stock and reorder advice is judged on. */
export async function saveThresholdsAction(input: {
  productId: string;
  reorderQuantity: number;
  threshold: number;
}): Promise<ActionResult> {
  const { actorId, merchantId } = await managerActor();

  const product = await db.query.products.findFirst({
    where: and(
      eq(products.id, input.productId),
      eq(products.merchantId, merchantId)
    ),
  });

  if (!product) {
    return failed("That product is not in this store.");
  }

  const patch = {
    lowStockThreshold: input.threshold,
    reorderPoint: input.threshold,
    reorderQuantity: input.reorderQuantity,
  };

  // Upsert: a product seeded without an inventory row still needs one.
  await db
    .insert(inventory)
    .values({ merchantId, productId: input.productId, ...patch })
    .onConflictDoUpdate({ set: patch, target: inventory.productId });

  await recordAudit({
    action: AuditAction.INVENTORY_THRESHOLD_UPDATED,
    actorId,
    actorType: "merchant",
    explanation: `Set ${product.name} to reorder ${input.reorderQuantity} at ${input.threshold} on hand.`,
    merchantId,
    metadata: { ...patch, productId: input.productId },
  });

  revalidateManager();

  return ok();
}

/**
 * Raises reorder requests for the selected lines in one go.
 *
 * They land as drafts, not as approvals. The merchant selecting rows on this
 * screen is saying "these are the ones", which is the same act the assistant
 * performs with `createReorderRequest` — and it goes to the same place, so the
 * queue below holds both and one decision closes either.
 */
export async function createPurchaseOrderAction(
  lines: { productId: string; quantity: number }[]
): Promise<ActionResult<{ created: number }>> {
  const { actorId, merchantId } = await managerActor();

  if (lines.length === 0) {
    return failed("Nothing was selected.");
  }

  const owned = await db
    .select({ id: products.id, name: products.name, stock: products.stock })
    .from(products)
    .where(
      and(
        eq(products.merchantId, merchantId),
        inArray(
          products.id,
          lines.map((line) => line.productId)
        )
      )
    );

  const byId = new Map(owned.map((row) => [row.id, row]));
  const valid = lines.filter(
    (line) => byId.has(line.productId) && line.quantity > 0
  );

  if (valid.length === 0) {
    return failed("None of those products are in this store.");
  }

  await db.insert(reorderRequests).values(
    valid.map((line) => ({
      createdByAgent: false,
      merchantId,
      productId: line.productId,
      quantity: line.quantity,
      reason: `Raised from the restock screen: ${byId.get(line.productId)?.stock ?? 0} on hand.`,
      status: "draft" as const,
      stockAtRequest: byId.get(line.productId)?.stock ?? null,
    }))
  );

  await recordAudit({
    action: AuditAction.REORDER_REQUESTED,
    actorId,
    actorType: "merchant",
    explanation: `Raised ${valid.length} reorder request(s) from the restock screen. Nothing has been ordered.`,
    merchantId,
    metadata: { lines: valid },
  });

  revalidateManager();

  return ok({ created: valid.length });
}

/* ------------------------------------------------------------------- orders */

/**
 * Refunds a captured payment in full.
 *
 * Razorpay is the authority here and it can and does refuse — an uncaptured
 * payment, an amount over what was taken. When it does, nothing local moves:
 * the order and the payment keep the state they had, the refusal is written to
 * `failures` with the gateway's own message, and the merchant is told what
 * happened rather than shown a success the money never followed.
 */
export async function refundOrderAction(
  orderId: string
): Promise<ActionResult> {
  const { actorId, merchantId } = await managerActor();

  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.merchantId, merchantId)),
  });

  if (!order) {
    return failed("That order is not in this store.");
  }

  const payment = await db.query.payments.findFirst({
    where: and(eq(payments.orderId, orderId), eq(payments.status, "captured")),
  });

  if (!payment?.razorpayPaymentId) {
    return failed(
      "There is no captured payment on this order, so there is nothing to refund. Nothing was charged."
    );
  }

  try {
    await refundPayment({ razorpayPaymentId: payment.razorpayPaymentId });
  } catch (error) {
    const problem = toPaymentError(error);

    await recordFailure({
      errorMessage: problem.message,
      errorType: "REFUND_REJECTED",
      orderId,
    });

    await recordAudit({
      action: AuditAction.REFUND_FAILED,
      actorId,
      actorType: "merchant",
      explanation: `Razorpay refused the refund: ${problem.message}. No money moved and the order is unchanged.`,
      merchantId,
      metadata: { code: problem.code, razorpayPaymentId: payment.razorpayPaymentId },
      orderId,
    });

    return failed(
      `Razorpay refused the refund: ${problem.message} Nothing was refunded and the order is unchanged.`
    );
  }

  await recordAudit({
    action: AuditAction.REFUND_ISSUED,
    actorId,
    actorType: "merchant",
    explanation: `Refunded the order in full from the orders screen.`,
    merchantId,
    metadata: { amountPaise: payment.amount },
    orderId,
  });

  revalidateManager();

  return ok();
}

/** The merchant half of the approval queue, from the screen instead of the chat. */
export async function decideAgentOrderAction(input: {
  decision: "approve" | "reject";
  explanation: string;
  orderId: string;
}): Promise<ActionResult> {
  const { actorId, merchantId } = await managerActor();

  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, input.orderId), eq(orders.merchantId, merchantId)),
  });

  if (!order) {
    return failed("That order is not in this store.");
  }

  if (order.approvalStatus !== "pending_approval") {
    return failed(`That order is already ${order.approvalStatus}.`);
  }

  const explanation = input.explanation.trim() || "No reason given.";

  try {
    if (input.decision === "approve") {
      await approveOrder({ actorId, explanation, orderId: input.orderId });
    } else {
      await rejectOrder({ actorId, explanation, orderId: input.orderId });
    }
  } catch (error) {
    return failed(toPaymentError(error).message);
  }

  await recordAudit({
    action:
      input.decision === "approve"
        ? AuditAction.APPROVAL_GRANTED
        : AuditAction.APPROVAL_DENIED,
    actorId,
    actorType: "merchant",
    explanation,
    merchantId,
    orderId: input.orderId,
  });

  revalidateManager();

  return ok();
}

/* ----------------------------------------------------------------- products */

export async function saveProductAction(input: {
  brand: string;
  category: string;
  name: string;
  pricePaise: number;
  /** Absent when this is a new product. */
  productId?: string;
  stock: number;
}): Promise<ActionResult<{ productId: string }>> {
  const { actorId, merchantId } = await managerActor();

  if (input.name.trim().length === 0) {
    return failed("A product needs a name.");
  }

  if (input.pricePaise <= 0) {
    return failed("A product needs a price.");
  }

  const fields = {
    brand: input.brand.trim() || null,
    category: input.category.trim() || null,
    name: input.name.trim(),
    price: input.pricePaise,
    stock: input.stock,
  };

  if (input.productId) {
    const existing = await db.query.products.findFirst({
      where: and(
        eq(products.id, input.productId),
        eq(products.merchantId, merchantId)
      ),
    });

    if (!existing) {
      return failed("That product is not in this store.");
    }

    await db
      .update(products)
      .set(fields)
      .where(eq(products.id, input.productId));

    await recordAudit({
      action: AuditAction.PRODUCT_UPDATED,
      actorId,
      actorType: "merchant",
      explanation: `Edited ${fields.name} from the products screen.`,
      merchantId,
      metadata: {
        // Both sides, so a price change is legible in the trail without
        // needing the row's history to reconstruct it.
        after: fields,
        before: {
          brand: existing.brand,
          category: existing.category,
          name: existing.name,
          price: existing.price,
          stock: existing.stock,
        },
        productId: input.productId,
      },
    });

    revalidateManager();

    return ok({ productId: input.productId });
  }

  const [created] = await db
    .insert(products)
    .values({ ...fields, merchantId })
    .returning();

  if (!created) {
    return failed("Could not save that product.");
  }

  await recordAudit({
    action: AuditAction.PRODUCT_CREATED,
    actorId,
    actorType: "merchant",
    explanation: `Added ${fields.name} to the catalogue.`,
    merchantId,
    metadata: { productId: created.id, ...fields },
  });

  revalidateManager();

  return ok({ productId: created.id });
}

/**
 * Copies a product as a new, inactive row.
 *
 * Inactive because a duplicate is a starting point, not a listing: published
 * live it would be a second identical product in the catalogue and in every
 * search the buying agent runs.
 */
export async function duplicateProductAction(
  productId: string
): Promise<ActionResult<{ productId: string }>> {
  const { actorId, merchantId } = await managerActor();

  const source = await db.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.merchantId, merchantId)),
  });

  if (!source) {
    return failed("That product is not in this store.");
  }

  const [copy] = await db
    .insert(products)
    .values({
      brand: source.brand,
      category: source.category,
      categoryId: source.categoryId,
      description: source.description,
      imageUrl: source.imageUrl,
      isActive: false,
      merchantId,
      name: `${source.name} (copy)`,
      price: source.price,
      stock: 0,
    })
    .returning();

  if (!copy) {
    return failed("Could not duplicate that product.");
  }

  await recordAudit({
    action: AuditAction.PRODUCT_CREATED,
    actorId,
    actorType: "merchant",
    explanation: `Duplicated ${source.name} as a draft. It is not on sale.`,
    merchantId,
    metadata: { copiedFrom: productId, productId: copy.id },
  });

  revalidateManager();

  return ok({ productId: copy.id });
}

/**
 * Takes a product off sale. It is never deleted.
 *
 * §11 is explicit that discontinuation is a recommendation and never an
 * automatic deletion, and there is a harder reason too: `order_items`
 * references products with `onDelete: "restrict"`, so deleting one would
 * either fail or, if it succeeded, erase what a past order actually contained.
 * Off sale is the honest operation and the reversible one.
 */
export async function deactivateProductAction(
  productId: string
): Promise<ActionResult> {
  const { actorId, merchantId } = await managerActor();

  const product = await db.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.merchantId, merchantId)),
  });

  if (!product) {
    return failed("That product is not in this store.");
  }

  await db
    .update(products)
    .set({ isActive: false })
    .where(eq(products.id, productId));

  await recordAudit({
    action: AuditAction.PRODUCT_DEACTIVATED,
    actorId,
    actorType: "merchant",
    explanation: `Took ${product.name} off sale. The product still exists and past orders still name it.`,
    merchantId,
    metadata: { productId },
  });

  revalidateManager();

  return ok();
}
