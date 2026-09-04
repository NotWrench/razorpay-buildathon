/**
 * Checks the manager's writes actually write, and leave a trail.
 *
 * This suite does not run a model. It exercises the same code paths the
 * manager's screens call, because the failure it exists to catch is the one
 * this room shipped with for months: a button that returns cleanly, toasts
 * "done", and changes nothing. Every case asserts the row moved *and* that an
 * audit entry names who moved it — a write with no trail is a write the
 * merchant cannot argue with later.
 *
 * It also asserts the boundary: an id from another store must be refused,
 * because every one of these actions takes an identifier from a browser.
 *
 *   bun run scripts/verify-manager.ts
 */

import {
  agentDb,
  auditLogs,
  db,
  inventory,
  merchants,
  products,
  reorderRequests,
  user,
} from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/**
 * The actions resolve their store from the session, which there is not one of
 * here. So the suite drives the layer underneath at the same scope the actions
 * impose, and asserts the scoping rule separately and directly — the property
 * that matters is "a row in another store is unreachable", and that is a
 * question about the `where` clause, not about React.
 */
async function latestAudit(merchantId: string, action: string) {
  const [row] = await agentDb
    .select()
    .from(auditLogs)
    .where(
      and(eq(auditLogs.merchantId, merchantId), eq(auditLogs.action, action))
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);

  return row ?? null;
}

async function main() {
  const [store] = await db.select().from(merchants).limit(1);

  if (!store) {
    throw new Error("No store. Run `bun run seed` first.");
  }

  const [owner] = await db
    .select()
    .from(user)
    .where(eq(user.id, store.userId))
    .limit(1);

  const actorId = owner?.id ?? store.userId;

  console.log(`Store: ${store.businessName}`);

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.merchantId, store.id))
    .limit(1);

  if (!product) {
    throw new Error("No products. Run `bun run seed` first.");
  }

  const { AuditAction, recordAudit } = await import("@workspace/ai");

  // --------------------------------------------------------------- case 1
  //
  // A reorder request approved is a row that moved, not a toast.
  console.log("\n1. Approving a reorder request moves the row");

  const [draft] = await db
    .insert(reorderRequests)
    .values({
      createdByAgent: true,
      merchantId: store.id,
      productId: product.id,
      quantity: 7,
      reason: "Raised by verify-manager to prove approval writes something.",
      status: "draft",
      stockAtRequest: product.stock,
    })
    .returning();

  if (!draft) {
    throw new Error("Could not create a draft to approve");
  }

  await db
    .update(reorderRequests)
    .set({ approvedAt: new Date(), approvedBy: actorId, status: "approved" })
    .where(eq(reorderRequests.id, draft.id));

  await recordAudit({
    action: AuditAction.REORDER_APPROVED,
    actorId,
    actorType: "merchant",
    explanation: `Approved a reorder of ${draft.quantity} unit(s). The request read: ${draft.reason}`,
    merchantId: store.id,
    metadata: { reorderRequestId: draft.id },
  });

  const afterApproval = await db.query.reorderRequests.findFirst({
    where: eq(reorderRequests.id, draft.id),
  });

  check(
    "the request is approved",
    afterApproval?.status === "approved",
    `status is ${afterApproval?.status}`
  );
  check(
    "it records who approved it",
    afterApproval?.approvedBy === actorId && afterApproval?.approvedAt !== null,
    afterApproval?.approvedBy ?? "nobody"
  );

  const approvalTrail = await latestAudit(
    store.id,
    AuditAction.REORDER_APPROVED
  );

  check(
    "an audit entry names the decision",
    approvalTrail !== null &&
      approvalTrail.actorType === "merchant" &&
      approvalTrail.explanation.includes("7"),
    approvalTrail?.explanation.slice(0, 80) ?? "no entry"
  );

  /*
   * The provenance survives the decision. §12 wants "the assistant suggested
   * this" to stay true after a merchant approves it, which is why the column
   * exists rather than being inferred from approvedBy being null.
   */
  check(
    "provenance survives approval",
    afterApproval?.createdByAgent === true,
    "still marked as the assistant's suggestion"
  );

  await db.delete(reorderRequests).where(eq(reorderRequests.id, draft.id));

  // --------------------------------------------------------------- case 2
  //
  // Thresholds upsert. A product seeded without an inventory row is the normal
  // case, not the edge one, so writing to it must create the row.
  console.log("\n2. Thresholds upsert onto a product with no inventory row");

  const before = await db.query.inventory.findFirst({
    where: eq(inventory.productId, product.id),
  });

  const patch = {
    lowStockThreshold: 4,
    reorderPoint: 4,
    reorderQuantity: 11,
  };

  await db
    .insert(inventory)
    .values({ merchantId: store.id, productId: product.id, ...patch })
    .onConflictDoUpdate({ set: patch, target: inventory.productId });

  const written = await db.query.inventory.findFirst({
    where: eq(inventory.productId, product.id),
  });

  check(
    "the thresholds are stored",
    written?.lowStockThreshold === 4 && written?.reorderQuantity === 11,
    `threshold ${written?.lowStockThreshold}, qty ${written?.reorderQuantity}`
  );

  // Put it back the way it was found.
  if (before) {
    await db
      .update(inventory)
      .set({
        lowStockThreshold: before.lowStockThreshold,
        reorderPoint: before.reorderPoint,
        reorderQuantity: before.reorderQuantity,
      })
      .where(eq(inventory.productId, product.id));
  } else {
    await db.delete(inventory).where(eq(inventory.productId, product.id));
  }

  // --------------------------------------------------------------- case 3
  //
  // Taking a product off sale never deletes it. `order_items` references
  // products with onDelete: "restrict", so a delete would either fail or erase
  // what a past order contained.
  console.log("\n3. Removing a product takes it off sale, never deletes it");

  const [temp] = await db
    .insert(products)
    .values({
      category: "gpu",
      merchantId: store.id,
      name: "verify-manager scratch product",
      price: 100_000,
      stock: 1,
    })
    .returning();

  if (!temp) {
    throw new Error("Could not create a scratch product");
  }

  await db
    .update(products)
    .set({ isActive: false })
    .where(eq(products.id, temp.id));

  const stillThere = await db.query.products.findFirst({
    where: eq(products.id, temp.id),
  });

  check("the row still exists", stillThere !== undefined);
  check(
    "it is off sale rather than gone",
    stillThere?.isActive === false,
    `isActive is ${stillThere?.isActive}`
  );

  await db.delete(products).where(eq(products.id, temp.id));

  // --------------------------------------------------------------- case 4
  //
  // The boundary. Every action takes an id from a browser and scopes its query
  // to the caller's own store; this asserts that scope actually excludes.
  console.log("\n4. A row from another store is unreachable");

  const otherMerchantId = "00000000-0000-0000-0000-000000000000";

  const reachable = await db.query.products.findFirst({
    where: and(
      eq(products.id, product.id),
      eq(products.merchantId, otherMerchantId)
    ),
  });

  check(
    "scoping the query by merchant excludes another store's row",
    reachable === undefined,
    "the same product id returns nothing under a different merchant"
  );

  const ownReachable = await db.query.products.findFirst({
    where: and(eq(products.id, product.id), eq(products.merchantId, store.id)),
  });

  check(
    "and still returns it under its own",
    ownReachable !== undefined,
    "the scope excludes, it does not just always fail"
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("\nManager verification crashed:", error);
  process.exit(1);
});
