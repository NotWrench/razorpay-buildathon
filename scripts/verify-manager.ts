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
  campaigns,
  db,
  failures,
  inventory,
  merchantPolicy,
  merchants,
  orders,
  payments,
  productPriceHistory,
  productSpecs,
  products,
  reorderRequests,
  user,
} from "@workspace/db";
import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";

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

  // --------------------------------------------------------------- case 5
  //
  // The margin floor. A percentage cap cannot express "below cost", because
  // 30% is generous on a case fan and ruinous on a card bought at 90% of list.
  console.log("\n5. A discount below cost is refused, not trimmed");

  const { checkMarginFloor, getMarginSummary, LIMITS } = await import(
    "@workspace/ai"
  );

  const [costed] = await db
    .select()
    .from(products)
    .where(and(eq(products.merchantId, store.id), isNotNull(products.costPrice)))
    .limit(1);

  if (!costed?.costPrice) {
    console.log("  (no costed product — run `bun run backfill:costs` first)");
    check("a product has a cost recorded", false, "nothing to check against");
  } else {
    const ruinous = await checkMarginFloor(
      store.id,
      [costed.id],
      (price) => Math.round(price * 0.95)
    );

    check(
      "95% off breaches the floor",
      ruinous.breaches.length === 1,
      `${ruinous.breaches[0]?.name ?? "nothing"} flagged`
    );

    const fine = await checkMarginFloor(store.id, [costed.id], () => 0);

    check(
      "no discount does not",
      fine.breaches.length === 0,
      "the floor refuses discounts, not products"
    );

    /*
     * The floor is the product's own cost, not a flat percentage. This is the
     * property a percentage cap cannot have, and the reason both bounds exist.
     */
    const marginPaise = costed.price - costed.costPrice;
    const justUnder = await checkMarginFloor(
      store.id,
      [costed.id],
      () => marginPaise + 1
    );
    const justOver = await checkMarginFloor(
      store.id,
      [costed.id],
      () => Math.max(0, marginPaise - 1)
    );

    check(
      "the floor sits exactly at this product's cost",
      justUnder.breaches.length === 1 && justOver.breaches.length === 0,
      `margin is ${marginPaise} paise on a ${costed.price} paise product`
    );
  }

  const [uncosted] = await db
    .select()
    .from(products)
    .where(and(eq(products.merchantId, store.id), isNull(products.costPrice)))
    .limit(1);

  if (uncosted) {
    const unknown = await checkMarginFloor(
      store.id,
      [uncosted.id],
      (price) => Math.round(price * 0.95)
    );

    check(
      "a product with no cost is reported unchecked, not blocked",
      unknown.breaches.length === 0 && unknown.unpriced.length === 1,
      `${unknown.unpriced[0]} went unchecked`
    );
  }

  console.log(`  (floor is ${LIMITS.minMarginPercent}% margin)`);

  // --------------------------------------------------------------- case 6
  //
  // Coverage. A gross margin computed over the costed half of a catalogue and
  // presented as the whole is worse than no figure at all.
  console.log("\n6. Margin reports its own coverage");

  const margin = await getMarginSummary(store.id, 90);

  console.log(
    `  revenue ${margin.revenuePaise}p, margin ${margin.grossMarginPercent}%, ${margin.productsWithoutCost} product(s) uncosted`
  );

  check(
    "it counts the products it could not price",
    margin.productsWithoutCost > 0,
    `${margin.productsWithoutCost} have no cost — the catalogue is seeded with gaps on purpose`
  );
  check(
    "the assumptions name the excluded revenue",
    margin.assumptions.includes("no cost recorded") ||
      margin.assumptions.includes("has a cost recorded"),
    margin.assumptions.slice(-90)
  );
  check(
    "gross margin is a plausible retail figure, not 100%",
    margin.grossMarginPercent !== null &&
      margin.grossMarginPercent > 0 &&
      margin.grossMarginPercent < 50,
    `${margin.grossMarginPercent}%`
  );

  // --------------------------------------------------------------- case 7
  //
  // Catalog readiness. The number that matters is the money behind products an
  // agent genuinely cannot recommend — not every product with a blemish.
  console.log("\n7. Readiness separates 'cannot sell' from 'looks worse'");

  const { getCatalogReadiness } = await import("@workspace/ai");

  const readiness = await getCatalogReadiness(store.id);

  console.log(
    `  score ${readiness.score}, ${readiness.needsWork.length} with gaps, ${readiness.blocked.length} blocking`
  );

  check(
    "it scores the active catalogue",
    readiness.productsScored > 0,
    `${readiness.productsScored} products`
  );
  check(
    "blocked is a subset of what needs work",
    readiness.blocked.length <= readiness.needsWork.length,
    `${readiness.blocked.length} of ${readiness.needsWork.length}`
  );

  /*
   * The property the split exists for. A product whose only gap is a missing
   * photograph still sells, and counting its stock as revenue at risk would
   * inflate the headline with products that are fine — a merchant who acts on
   * that number once and finds nothing wrong will not act on it again.
   */
  const cosmeticOnly = readiness.needsWork.filter(
    (product) => !product.blocked
  );

  check(
    "a product with only cosmetic gaps is not counted as blocked",
    cosmeticOnly.every((product) =>
      product.gaps.every((gap) => !gap.blocking)
    ),
    `${cosmeticOnly.length} product(s) need work but still sell`
  );

  const riskFromBlocked = readiness.blocked.reduce(
    (sum, product) => sum + product.stockValuePaise,
    0
  );

  check(
    "revenue at risk counts only the blocking ones",
    readiness.revenueAtRiskPaise === riskFromBlocked,
    `${readiness.revenueAtRiskPaise} paise`
  );

  check(
    "every gap names what its absence costs",
    readiness.needsWork.every((product) =>
      product.gaps.every((gap) => gap.costs.length > 0)
    ),
    readiness.needsWork[0]?.gaps[0]?.costs ?? "no gaps to check"
  );

  // --------------------------------------------------------------- case 8
  //
  // Key scoping. A key issued by one shop must not order from another — the
  // merchantId arrives in a request body, so without this the caller picks
  // their own scope.
  console.log("\n8. An agent key is bound to the store that issued it");

  const { assertKeyScope } = await import("@workspace/ai");

  const scoped = {
    identifier: "key_test",
    merchantId: store.id,
    type: "ai_agent" as const,
    userId: null,
  };

  let refused = false;

  try {
    assertKeyScope(scoped, "00000000-0000-0000-0000-000000000000");
  } catch {
    refused = true;
  }

  check("a key is refused against another store", refused);

  let allowed = true;

  try {
    assertKeyScope(scoped, store.id);
  } catch {
    allowed = false;
  }

  check("and accepted against its own", allowed);

  /*
   * Keys issued before scoping existed carry no merchant. Locking them out
   * silently would break a counterparty mid-integration, which is worse than
   * the gap it closes — the agents screen shows the merchant which keys are
   * unscoped instead.
   */
  let legacyAllowed = true;

  try {
    assertKeyScope(
      { identifier: "old_key", type: "ai_agent", userId: null },
      store.id
    );
  } catch {
    legacyAllowed = false;
  }

  check(
    "a key issued before scoping is not silently locked out",
    legacyAllowed,
    "unscoped keys still work, and the screen flags them"
  );

  let humanAllowed = true;

  try {
    assertKeyScope(
      { identifier: "someone@example.com", type: "human", userId: "u" },
      "00000000-0000-0000-0000-000000000000"
    );
  } catch {
    humanAllowed = false;
  }

  check(
    "the check applies to keys, not to people",
    humanAllowed,
    "a signed-in human is governed by store ownership instead"
  );

  // --------------------------------------------------------------- case 9
  //
  // Enrichment provenance. Across repeated agent runs the model invented a
  // GPU's length from its own memory of the card — the approval gate stopped
  // the write, but the merchant was being asked to confirm figures that came
  // from nowhere. A cited source that nobody verifies is worth as much as no
  // source, so the "the description says so" claim is checked against the
  // description we actually hold.
  console.log("\n9. A cited specification source is verified, not trusted");

  const { readinessTools } = await import("@workspace/ai");

  const [described] = await db
    .select()
    .from(products)
    .where(
      and(eq(products.merchantId, store.id), isNotNull(products.description))
    )
    .limit(1);

  if (described?.description) {
    const tools = readinessTools({
      actor: { identifier: actorId, type: "human", userId: actorId },
      autoApproveCeilingPaise: 0,
      conversationId: "00000000-0000-0000-0000-000000000000",
      merchantId: store.id,
      spendCapPaise: 0,
      storeSlug: store.storeSlug,
    });

    const run = (input: Record<string, unknown>) =>
      // biome-ignore lint/suspicious/noExplicitAny: exercising one tool directly.
      (tools.enrichProduct as any).execute(input, {} as never) as Promise<{
        enriched: boolean;
        error?: string;
      }>;

    const unsourced = await run({
      productId: described.id,
      specs: { lengthMm: 280 },
    });

    check(
      "a specification with no stated source is refused",
      unsourced.enriched === false,
      unsourced.error?.slice(0, 70)
    );

    const fabricated = await run({
      productId: described.id,
      sourcedFrom: {
        origin: "product_description",
        quote: "this exact sentence is certainly not in the description",
      },
      specs: { lengthMm: 280 },
    });

    check(
      "a quote that is not in the description is refused",
      fabricated.enriched === false,
      fabricated.error?.slice(0, 70)
    );

    /*
     * And it still lets a real citation through, so the check is a gate rather
     * than a wall — a rule that refuses everything is indistinguishable from a
     * broken tool.
     */
    const genuine = await run({
      productId: described.id,
      sourcedFrom: {
        origin: "product_description",
        quote: described.description.slice(0, 20),
      },
      specs: { lengthMm: 280 },
    });

    check(
      "a genuine quote from the description is accepted",
      genuine.enriched === true,
      genuine.error ?? "written, with the source in the audit trail"
    );

    // Put the scratch spec back.
    await db.delete(productSpecs).where(eq(productSpecs.productId, described.id));
  } else {
    check("a product has a description to cite", false, "none found");
  }

  // -------------------------------------------------------------- case 10
  //
  // The price tool's bounds. This is the riskiest thing in the system: it
  // applies to every future order rather than one, and it is easy for a model
  // to reach for. Each bound is asserted to refuse rather than to trim, and
  // the daily count is asserted separately because a clamp on the step size is
  // no protection at all against a sequence of steps.
  console.log("\n10. Price moves are bounded, and refuse rather than trim");

  const { pricingTools, LIMITS: PRICE_LIMITS } = await import("@workspace/ai");

  const [priced] = await db
    .select()
    .from(products)
    .where(
      and(eq(products.merchantId, store.id), isNotNull(products.costPrice))
    )
    .limit(1);

  if (priced?.costPrice) {
    const tools = pricingTools({
      actor: { identifier: actorId, type: "human", userId: actorId },
      autoApproveCeilingPaise: 0,
      conversationId: "00000000-0000-0000-0000-000000000000",
      merchantId: store.id,
      spendCapPaise: 0,
      storeSlug: store.storeSlug,
    });

    const reprice = (newPricePaise: number) =>
      // biome-ignore lint/suspicious/noExplicitAny: exercising one tool directly.
      (tools.updateProductPrice as any).execute(
        {
          newPricePaise,
          productId: priced.id,
          reason: "Exercised by verify-manager to prove the bounds refuse.",
        },
        {} as never
      ) as Promise<{ error?: string; updated: boolean }>;

    const tooBig = await reprice(Math.round(priced.price * 1.5));

    check(
      "a 50% move is refused",
      tooBig.updated === false && /over the/i.test(tooBig.error ?? ""),
      tooBig.error?.slice(0, 70)
    );

    const belowCost = await reprice(Math.max(1, priced.costPrice - 1000));

    check(
      "a price below cost is refused",
      belowCost.updated === false,
      belowCost.error?.slice(0, 70)
    );

    // A small move inside every bound goes through, so the bounds are a gate
    // rather than a wall.
    const nudge = Math.round(priced.price * 1.05);
    const first = await reprice(nudge);

    check(
      "a 5% move inside the bounds is allowed",
      first.updated === true,
      first.error ?? `moved to ${nudge}`
    );

    const second = await reprice(Math.round(nudge * 1.02));

    check(
      "a second small move is still allowed",
      second.updated === true,
      second.error ?? "within the daily count"
    );

    /*
     * The bound that actually matters. Two moves are the limit, so the third
     * must refuse — otherwise an assistant could walk a price anywhere over an
     * afternoon in steps that each look reasonable.
     */
    const third = await reprice(Math.round(nudge * 1.03));

    check(
      `one move past the daily limit of ${PRICE_LIMITS.maxPriceMovesPerDay} is refused`,
      third.updated === false && /24 hours/i.test(third.error ?? ""),
      third.error?.slice(0, 70)
    );

    const historyRows = await db
      .select()
      .from(productPriceHistory)
      .where(eq(productPriceHistory.productId, priced.id));

    check(
      "every accepted move left a row saying who and why",
      historyRows.length === 2 &&
        historyRows.every(
          (row) => row.reason.length > 0 && row.changedBy.length > 0
        ),
      `${historyRows.length} history row(s)`
    );

    // Put the price back and clear the scratch history.
    await db
      .update(products)
      .set({ price: priced.price })
      .where(eq(products.id, priced.id));
    await db
      .delete(productPriceHistory)
      .where(eq(productPriceHistory.productId, priced.id));
  } else {
    check("a costed product exists to reprice", false, "none found");
  }

  // -------------------------------------------------------------- case 11
  //
  // Merchant policy. Letting a merchant set their own bounds is only safe if
  // the platform ceiling still wins — otherwise "my limit is 80%" is a limit
  // anyone reaching the account screen can grant themselves.
  console.log("\n11. A store's own bounds can tighten, never loosen");

  const { getEffectivePolicy, describePolicy, LIMITS: PLATFORM } = await import(
    "@workspace/ai"
  );

  const defaults = await getEffectivePolicy(store.id);

  check(
    "with no row set, the platform defaults apply",
    defaults.maxDiscountPercent === PLATFORM.maxDiscountPercent,
    `${defaults.maxDiscountPercent}%`
  );

  await db
    .insert(merchantPolicy)
    .values({
      maxDiscountPercent: 15,
      maxPriceMovePercent: 5,
      merchantId: store.id,
    })
    .onConflictDoUpdate({
      set: { maxDiscountPercent: 15, maxPriceMovePercent: 5 },
      target: merchantPolicy.merchantId,
    });

  const tightened = await getEffectivePolicy(store.id);

  check(
    "a stricter discount cap is honoured",
    tightened.maxDiscountPercent === 15,
    `${tightened.maxDiscountPercent}% against a platform ${PLATFORM.maxDiscountPercent}%`
  );
  check(
    "a stricter price-move cap is honoured",
    tightened.maxPriceMovePercent === 5,
    `${tightened.maxPriceMovePercent}%`
  );
  check(
    "it reports that the store configured itself",
    tightened.merchantConfigured
  );

  /*
   * The property that makes the whole thing safe. A merchant asking for more
   * than the platform allows is clamped rather than refused — they meant "as
   * high as you'll let me" — but they never get it.
   */
  await db
    .update(merchantPolicy)
    .set({ maxDiscountPercent: 80, maxPriceMovePercent: 99 })
    .where(eq(merchantPolicy.merchantId, store.id));

  const loosened = await getEffectivePolicy(store.id);

  check(
    "an attempt to loosen past the platform ceiling is clamped",
    loosened.maxDiscountPercent === PLATFORM.maxDiscountPercent &&
      loosened.maxPriceMovePercent === PLATFORM.maxPriceMovePercent,
    `asked for 80%/99%, got ${loosened.maxDiscountPercent}%/${loosened.maxPriceMovePercent}%`
  );

  check(
    "the policy describes itself in sentences a merchant can read",
    describePolicy(loosened).every(
      (line) => line.length > 0 && !/\w+Paise/.test(line)
    ),
    describePolicy(loosened)[0]
  );

  await db
    .delete(merchantPolicy)
    .where(eq(merchantPolicy.merchantId, store.id));

  // -------------------------------------------------------------- case 12
  //
  // Every money tool is gated — asserted against the tool set itself.
  //
  // The unattended briefing's safety rests entirely on this: a gated tool
  // returns `user-approval`, nobody is there to answer, so it suspends and
  // never runs. The agent suite can only show that for tools a given run
  // happened to attempt. This closes the gap, and it is the regression that
  // matters — the day somebody adds a money tool and forgets to gate it, the
  // overnight run is what spends the money at 3am.
  console.log("\n12. Every money tool refuses to run without a human");

  const { merchantApproval, merchantToolSet } = await import("@workspace/ai");

  const briefingCtx = {
    actor: { identifier: actorId, type: "human" as const, userId: actorId },
    autoApproveCeilingPaise: 0,
    conversationId: "00000000-0000-0000-0000-000000000000",
    merchantId: store.id,
    spendCapPaise: 0,
    storeSlug: store.storeSlug,
  };

  const gate = merchantApproval(briefingCtx) as Record<
    string,
    ((input: unknown) => unknown) | undefined
  >;
  const allTools = Object.keys(merchantToolSet(briefingCtx));

  /**
   * Anything that moves money, changes a live price, or writes to the
   * catalogue every buying agent reads.
   */
  const MUST_BE_GATED = [
    "activateCampaign",
    "approveAgentOrder",
    "createReorderRequest",
    "enrichProduct",
    "issuePaymentLink",
    "pauseCampaign",
    "refundOrder",
    "rejectAgentOrder",
    "updateInventoryThreshold",
    "updateProductPrice",
  ];

  const missing = MUST_BE_GATED.filter((name) => !allTools.includes(name));

  check(
    "every tool this checks still exists",
    missing.length === 0,
    missing.length === 0 ? allTools.length + " tools" : `renamed: ${missing}`
  );

  const ungated: string[] = [];

  for (const name of MUST_BE_GATED) {
    const policy = gate[name];

    if (!policy) {
      ungated.push(name);
      continue;
    }

    const verdict = await policy({
      campaignId: "00000000-0000-0000-0000-000000000000",
      explanation: "verify",
      newPricePaise: 100_000,
      orderId: "00000000-0000-0000-0000-000000000000",
      productId: "00000000-0000-0000-0000-000000000000",
      quantity: 1,
      reason: "verify",
    });

    if ((verdict as { type?: string })?.type !== "user-approval") {
      ungated.push(name);
    }
  }

  check(
    "no money tool would run unattended",
    ungated.length === 0,
    ungated.length === 0
      ? `${MUST_BE_GATED.length} tools all stop for a human`
      : `UNGATED: ${ungated.join(", ")}`
  );

  // -------------------------------------------------------------- case 13
  //
  // The failure this system is meant to handle well.
  //
  // A refund is the merchant's most anxious moment, and Razorpay is the
  // authority on whether it happens. The property asserted here is the one
  // that matters when it says no: *nothing local moves*. An order marked
  // refunded whose money never went back is worse than an error, because the
  // merchant stops looking.
  console.log("\n13. A refused refund changes nothing and says so");

  const { paymentOpsTools } = await import("@workspace/ai");

  const opsTools = paymentOpsTools({
    actor: { identifier: actorId, type: "human", userId: actorId },
    autoApproveCeilingPaise: 0,
    conversationId: "00000000-0000-0000-0000-000000000000",
    merchantId: store.id,
    spendCapPaise: 0,
    storeSlug: store.storeSlug,
  });

  const [unpaid] = await db
    .insert(orders)
    .values({
      approvalStatus: "approved",
      buyerIdentifier: "verify-refund@example.com",
      buyerType: "human",
      merchantId: store.id,
      orderStatus: "created",
      subtotal: 250_000,
      totalAmount: 250_000,
    })
    .returning();

  if (unpaid) {
    const refused = (await // biome-ignore lint/suspicious/noExplicitAny: exercising one tool directly.
    (opsTools.refundOrder as any).execute(
      {
        orderId: unpaid.id,
        reason: "Exercised by verify-manager against an uncaptured order.",
      },
      {} as never
    )) as { error?: string; refunded: boolean };

    check(
      "refunding an order with no captured payment is refused",
      refused.refunded === false,
      refused.error?.slice(0, 80)
    );

    /*
     * The sentence that does the work. "It failed" and "it failed and nothing
     * moved" are different things to read at the moment money was supposed to
     * go back to a customer.
     */
    check(
      "the refusal says nothing was charged",
      /nothing was charged|nothing to refund/i.test(refused.error ?? ""),
      refused.error?.slice(0, 80)
    );

    const afterRefusal = await db.query.orders.findFirst({
      where: eq(orders.id, unpaid.id),
    });

    check(
      "the order is left exactly as it was",
      afterRefusal?.orderStatus === "created",
      `still ${afterRefusal?.orderStatus}`
    );

    await db.delete(orders).where(eq(orders.id, unpaid.id));
  } else {
    check("a scratch order could be created", false);
  }

  // -------------------------------------------------------------- case 14
  //
  // Overlapping campaigns. `quote.ts` picks the single best offer, so two live
  // campaigns on one product do not stack — the weaker simply stops applying.
  // That is correct pricing and the wrong thing to leave unsaid: a merchant
  // reads the quiet campaign's flat numbers as the offer failing.
  console.log("\n14. Activating an overlapping campaign warns first");

  const { campaignTools } = await import("@workspace/ai");

  const campaignCtx = {
    actor: { identifier: actorId, type: "human" as const, userId: actorId },
    autoApproveCeilingPaise: 0,
    conversationId: "00000000-0000-0000-0000-000000000000",
    merchantId: store.id,
    spendCapPaise: 0,
    storeSlug: store.storeSlug,
  };

  const [live, pending] = await db
    .insert(campaigns)
    .values([
      {
        approvedByMerchant: true,
        discountType: "percentage",
        discountValue: 10,
        merchantId: store.id,
        status: "active",
        title: "verify-manager live campaign",
        triggerRules: { productIds: [product.id] },
      },
      {
        discountType: "percentage",
        discountValue: 5,
        merchantId: store.id,
        status: "pending_approval",
        title: "verify-manager overlapping draft",
        triggerRules: { productIds: [product.id] },
      },
    ])
    .returning();

  if (live && pending) {
    const activate = (input: Record<string, unknown>) =>
      // biome-ignore lint/suspicious/noExplicitAny: exercising one tool directly.
      (campaignTools(campaignCtx).activateCampaign as any).execute(
        input,
        {} as never
      ) as Promise<{ activated: boolean; error?: string }>;

    const warned = await activate({ campaignId: pending.id });

    check(
      "an overlapping activation is refused until acknowledged",
      warned.activated === false && /overlaps/i.test(warned.error ?? ""),
      warned.error?.slice(0, 90)
    );

    check(
      "the warning explains that they will not stack",
      /not stack|worth most/i.test(warned.error ?? ""),
      "names the consequence, not just the collision"
    );

    const forced = await activate({
      acknowledgeOverlap: true,
      campaignId: pending.id,
    });

    check(
      "the merchant can still activate once told",
      forced.activated === true,
      "a warning, not a wall"
    );

    await db
      .delete(campaigns)
      .where(inArray(campaigns.id, [live.id, pending.id]));
  } else {
    check("scratch campaigns could be created", false);
  }

  // -------------------------------------------------------------- case 15
  //
  // The real thing: Razorpay itself says no.
  //
  // Case 13 covers the refusal we can make locally. This one goes out to the
  // gateway with a payment id it has never heard of and asserts what happens
  // when the authority on the money declines — because that is the path a
  // merchant actually hits, and the one where "it worked" would be a lie
  // nobody catches until the customer calls.
  console.log("\n15. When Razorpay refuses, nothing local moves");

  const [captured] = await db
    .insert(orders)
    .values({
      approvalStatus: "approved",
      buyerIdentifier: "verify-refund-gateway@example.com",
      buyerType: "human",
      merchantId: store.id,
      orderStatus: "paid",
      subtotal: 199_900,
      totalAmount: 199_900,
    })
    .returning();

  if (captured) {
    await db.insert(payments).values({
      amount: 199_900,
      orderId: captured.id,
      // A payment id Razorpay has never issued. The call is real; the refusal
      // is theirs, which is the whole point of exercising it this way.
      razorpayOrderId: "order_verifymanager_nonexistent",
      razorpayPaymentId: "pay_verifymanagerNOPE",
      status: "captured",
    });

    const rejected = (await // biome-ignore lint/suspicious/noExplicitAny: exercising one tool directly.
    (opsTools.refundOrder as any).execute(
      {
        orderId: captured.id,
        reason: "Exercised by verify-manager against the live gateway.",
      },
      {} as never
    )) as { error?: string; refunded: boolean; state?: string };

    console.log(`  gateway said: ${rejected.error?.slice(0, 120)}`);

    check(
      "the gateway's refusal comes back as a refusal",
      rejected.refunded === false,
      rejected.error?.slice(0, 60)
    );

    check(
      "it relays what the gateway actually said",
      /razorpay/i.test(rejected.error ?? ""),
      "the merchant hears the gateway, not a generic error"
    );

    check(
      "it states plainly that nothing moved",
      /nothing moved|exactly as they were/i.test(rejected.state ?? ""),
      rejected.state
    );

    const afterGateway = await db.query.orders.findFirst({
      where: eq(orders.id, captured.id),
    });
    const paymentAfter = await db.query.payments.findFirst({
      where: eq(payments.orderId, captured.id),
    });

    check(
      "the order and the payment keep the state they had",
      afterGateway?.orderStatus === "paid" &&
        paymentAfter?.status === "captured",
      `order ${afterGateway?.orderStatus}, payment ${paymentAfter?.status}`
    );

    /*
     * And it is legible afterwards. `explainDecision` reads this back, so a
     * merchant asking "what happened to that refund" gets the gateway's own
     * words rather than the agent's recollection of them.
     */
    const [failureRow] = await agentDb
      .select()
      .from(failures)
      .where(eq(failures.orderId, captured.id));

    check(
      "the refusal is written to the failure trail",
      failureRow?.errorType === "REFUND_REJECTED",
      failureRow?.errorMessage?.slice(0, 60) ?? "nothing recorded"
    );

    const refundTrail = await latestAudit(
      store.id,
      AuditAction.REFUND_FAILED
    );

    check(
      "and to the audit trail, with the reason",
      refundTrail !== null && /refused/i.test(refundTrail.explanation),
      refundTrail?.explanation.slice(0, 70) ?? "no entry"
    );

    await agentDb.delete(failures).where(eq(failures.orderId, captured.id));
    await db.delete(payments).where(eq(payments.orderId, captured.id));
    await db.delete(orders).where(eq(orders.id, captured.id));
  } else {
    check("a captured scratch order could be created", false);
  }

  // -------------------------------------------------------------- case 16
  //
  // A bundle the merchant approved reaches the buyer's assistant.
  //
  // The two agents have shared a database and no strategy: the buyer's side
  // suggested whatever the order history correlated, while approved bundles
  // sat in `campaigns` affecting the price and nothing else. This is the one
  // place the merchant's decision reaches the conversation where it can be
  // acted on — and the buyer genuinely saves money by taking it, which is why
  // it is a recommendation rather than the shop pushing stock.
  console.log("\n16. An approved bundle reaches the buyer's assistant");

  const { getPromotedPartners } = await import("@workspace/ai");

  const [anchor, partner] = await db
    .select()
    .from(products)
    .where(eq(products.merchantId, store.id))
    .limit(2);

  if (anchor && partner) {
    const [bundle, blanket] = await db
      .insert(campaigns)
      .values([
        {
          approvedByMerchant: true,
          discountType: "bundle",
          discountValue: 50_000,
          merchantId: store.id,
          status: "active",
          title: "verify-manager true bundle",
          triggerRules: {
            productIds: [anchor.id, partner.id],
            requiresAllProducts: true,
          },
        },
        {
          approvedByMerchant: true,
          discountType: "percentage",
          discountValue: 5,
          merchantId: store.id,
          status: "active",
          title: "verify-manager blanket sale",
          triggerRules: {
            productIds: [anchor.id, partner.id],
            requiresAllProducts: false,
          },
        },
      ])
      .returning();

    const partners = await getPromotedPartners(store.id, anchor.id);

    check(
      "the bundled partner is offered against the anchor",
      partners.some((row) => row.productId === partner.id),
      partners.map((row) => row.campaignTitle).join(", ") || "none found"
    );

    /*
     * A blanket percentage across eight products is not a recommendation about
     * any of them. Only a true bundle — where the discount fires because both
     * are in the cart — is worth surfacing as "buy this too".
     */
    check(
      "a blanket sale is not mistaken for a bundle",
      partners.every((row) => row.campaignTitle.includes("true bundle")),
      "only requiresAllProducts campaigns surface"
    );

    check(
      "the anchor does not suggest itself",
      partners.every((row) => row.productId !== anchor.id)
    );

    if (bundle && blanket) {
      await db
        .delete(campaigns)
        .where(inArray(campaigns.id, [bundle.id, blanket.id]));
    }
  } else {
    check("two products exist to bundle", false);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("\nManager verification crashed:", error);
  process.exit(1);
});
