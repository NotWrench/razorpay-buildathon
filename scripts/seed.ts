/**
 * Seeds the demo store: one merchant, the component taxonomy, a curated PC
 * catalog with real specifications, and a back-history of paid orders.
 *
 * Three things go in beside each product, and all three matter:
 *
 *   `product_categories`  so the system knows a part is a GPU rather than
 *                         guessing from a string.
 *   `product_specs`       so the compatibility engine has typed inputs. A spec
 *                         the catalog does not state is left null, because a
 *                         missing value has to reach the engine as
 *                         `insufficient_data` and not as a zero.
 *   `inventory`           so the admin agent can talk about reorder points
 *                         rather than inventing them.
 *
 * The order history is the point of the last section. Attach rates, slow
 * movers and cross-sell suggestions are computed from real `order_items` rows,
 * so without a plausible history the admin agent has nothing true to say.
 *
 * The seed is destructive by design. Every run deletes the existing demo store
 * and everything the agents wrote against it, then rewrites the whole thing
 * from `scripts/data`. There is no incremental mode and no `--reset` flag to
 * remember: a store that is half last week's catalog and half this one's is a
 * store no one can reason about, and the numbers the admin agent quotes stop
 * matching the data underneath. The owner login survives, because it is the
 * one row a Google account may already be linked to.
 *
 *   bun run seed
 */

import { auth } from "@workspace/auth";
import {
  account,
  agentDb,
  agentFeedback,
  agentMemoryLong,
  auditLogs,
  CATEGORY_DEFINITIONS,
  conversations,
  db,
  failures,
  inventory,
  merchants,
  orderItems,
  orders,
  payments,
  productCategories,
  productSpecs,
  products,
  user,
} from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { seedCostPaise } from "./data/costs";
import {
  PC_CANCELLATIONS,
  PC_CATALOG,
  PC_ORDER_HISTORY,
} from "./data/pc-catalog";

/**
 * How long ago the catalog was listed.
 *
 * Products default to `now()`, which would make every one of them brand new
 * beside an order history going back two months. Anything that asks "has this
 * had a fair chance to sell" — the discount and discontinue candidates — would
 * then exclude the entire catalog. A store with this much history has products
 * older than the history.
 */
const CATALOG_LISTED_DAYS_AGO = 120;

const STORE_SLUG = "nova-electronics";

/**
 * Who the demo store belongs to.
 *
 * Sign-in is Google-only, and Google will only ever hand back an address it
 * actually issues — so a store seeded to `merchant@example.com` is a store
 * nobody can sign in and own. Point `SEED_OWNER_EMAIL` at your own Google
 * address and the account linking in `packages/auth` attaches your first
 * Google sign-in to this same user, which is what makes the manager's
 * "Connect Razorpay" button work against a store you own.
 */
const OWNER_EMAIL =
  process.env.SEED_OWNER_EMAIL?.trim() || "merchant@example.com";
const OWNER_PASSWORD = "demo-password-123";

function daysAgo(days: number): Date {
  const date = new Date();

  date.setDate(date.getDate() - days);

  return date;
}

/**
 * The demo merchant account, with a password that actually works.
 *
 * A user row on its own is not a login: better-auth keeps the credential in
 * `account`, and a user without one cannot sign in. Returning early on the
 * user alone made the seed print a working login when there was none — worth
 * checking, because the failure only shows up at the sign-in page.
 */
async function ensureOwner(): Promise<string> {
  const existing = await db.query.user.findFirst({
    where: eq(user.email, OWNER_EMAIL),
  });

  if (existing) {
    const credential = await db.query.account.findFirst({
      where: eq(account.userId, existing.id),
    });

    if (credential) {
      return existing.id;
    }

    // A user with no credential is unusable and cannot be signed up over, so
    // it is removed and recreated rather than left to fail later.
    await db.delete(user).where(eq(user.id, existing.id));
  }

  await auth.api.signUpEmail({
    body: {
      email: OWNER_EMAIL,
      name: "Nova PC",
      password: OWNER_PASSWORD,
    },
  });

  const created = await db.query.user.findFirst({
    where: eq(user.email, OWNER_EMAIL),
  });

  if (!created) {
    throw new Error("Failed to create the demo merchant account");
  }

  return created.id;
}

/**
 * Clears everything a previous seed left behind.
 *
 * The seed rewrites the demo store from scratch every run: there is no
 * incremental path, because a catalog that is half old and half new is a store
 * nobody described. Deleting the merchant is enough on the business side —
 * categories, products, specs, inventory, carts, builds, orders, items,
 * payments, policy, price history and campaigns all hang off it with
 * `on delete cascade`.
 *
 * The agent database does not cascade, because it is a different database. Its
 * rows point at merchants and orders that are about to stop existing, so they
 * go too — an audit trail of actions taken against deleted orders is worse
 * than no trail. Order matters: `agent_feedback` references
 * `ai_recommendations` without a cascade, so it is cleared before the
 * conversations that own them.
 */
async function wipeExistingStore(userId: string): Promise<void> {
  const doomed = await db
    .delete(merchants)
    .where(
      or(eq(merchants.storeSlug, STORE_SLUG), eq(merchants.userId, userId))
    )
    .returning();

  if (doomed.length > 0) {
    console.log(`  ${doomed.length} existing store(s) removed`);
  }

  await agentDb.delete(agentFeedback);
  await agentDb.delete(conversations);
  await agentDb.delete(agentMemoryLong);
  await agentDb.delete(auditLogs);
  await agentDb.delete(failures);

  console.log("  agent memory, audit trail and failure log cleared");
}

async function main() {
  console.log("Seeding demo store...");

  const userId = await ensureOwner();

  await wipeExistingStore(userId);

  const [merchant] = await db
    .insert(merchants)
    .values({
      businessName: "Nova PC",
      currency: "INR",
      storeSlug: STORE_SLUG,
      userId,
    })
    .returning();

  if (!merchant) {
    throw new Error("Failed to create the merchant");
  }

  // ------------------------------------------------------------- taxonomy
  const categories = await db
    .insert(productCategories)
    .values(
      CATEGORY_DEFINITIONS.map((definition) => ({
        buildSlot: definition.buildSlot,
        isBuildComponent: definition.isBuildComponent,
        maxPerBuild: definition.maxPerBuild,
        merchantId: merchant.id,
        minPerBuild: definition.minPerBuild,
        name: definition.name,
        slug: definition.slug,
        sortOrder: definition.sortOrder,
      }))
    )
    .returning();

  const categoryIdBySlug = new Map(categories.map((row) => [row.slug, row.id]));

  console.log(`  ${categories.length} categories`);

  // -------------------------------------------------------------- catalog
  const listedAt = daysAgo(CATALOG_LISTED_DAYS_AGO);

  const inserted = await db
    .insert(products)
    .values(
      PC_CATALOG.map((item) => {
        const categoryId = categoryIdBySlug.get(item.categorySlug);

        if (!categoryId) {
          throw new Error(
            `${item.sku} names category "${item.categorySlug}", which is not in the taxonomy`
          );
        }

        return {
          attributes: item.attributes,
          brand: item.brand,
          // Mirrors the category slug. `categoryId` is authoritative; this is
          // the denormalised copy the search and display paths read.
          category: item.categorySlug,
          categoryId,
          costPrice: seedCostPaise(
            item.sku,
            item.categorySlug,
            item.priceRupees
          ),
          createdAt: listedAt,
          description: item.description,
          imageUrl: item.imageUrl,
          merchantId: merchant.id,
          name: item.name,
          price: item.priceRupees * 100,
          sku: item.sku,
          stock: item.stock,
        };
      })
    )
    .returning();

  const bySku = new Map(inserted.map((row) => [row.sku ?? "", row]));

  console.log(`  ${inserted.length} products`);

  // ---------------------------------------------------------------- specs
  const specRows = PC_CATALOG.flatMap((item) => {
    const product = bySku.get(item.sku);

    if (!(product && item.specs)) {
      return [];
    }

    return [
      {
        categorySlug: item.categorySlug,
        merchantId: merchant.id,
        productId: product.id,
        ...item.specs,
      },
    ];
  });

  await db.insert(productSpecs).values(specRows);

  console.log(`  ${specRows.length} spec sheets`);

  // ------------------------------------------------------------ inventory
  const inventoryRows = PC_CATALOG.flatMap((item) => {
    const product = bySku.get(item.sku);

    if (!(product && item.inventory)) {
      return [];
    }

    const { lastRestockedDaysAgo, ...rest } = item.inventory;

    return [
      {
        lastRestockedAt:
          lastRestockedDaysAgo === undefined
            ? null
            : daysAgo(lastRestockedDaysAgo),
        merchantId: merchant.id,
        productId: product.id,
        ...rest,
      },
    ];
  });

  await db.insert(inventory).values(inventoryRows);

  console.log(`  ${inventoryRows.length} inventory records`);

  // -------------------------------------------------------------- history
  let orderCount = 0;

  for (const [index, historical] of PC_ORDER_HISTORY.entries()) {
    const lines = historical.skus
      .map((sku) => bySku.get(sku))
      .filter((product): product is NonNullable<typeof product> =>
        Boolean(product)
      )
      .map((product) => ({
        product,
        quantity: 1,
      }));

    if (lines.length === 0) {
      continue;
    }

    const subtotal = lines.reduce(
      (sum, line) => sum + line.product.price * line.quantity,
      0
    );

    const createdAt = daysAgo(historical.daysAgo);

    const [order] = await db
      .insert(orders)
      .values({
        approvalStatus: "approved",
        buyerIdentifier: `shopper${index + 1}@example.com`,
        buyerType: "human",
        createdAt,
        currency: "INR",
        merchantId: merchant.id,
        orderStatus: "paid",
        razorpayOrderId: `order_seed_${index + 1}`,
        subtotal,
        totalAmount: subtotal,
        updatedAt: createdAt,
      })
      .returning();

    if (!order) {
      continue;
    }

    await db.insert(orderItems).values(
      lines.map((line) => ({
        orderId: order.id,
        productId: line.product.id,
        quantity: line.quantity,
        subtotal: line.product.price * line.quantity,
        unitPrice: line.product.price,
      }))
    );

    await db.insert(payments).values({
      amount: subtotal,
      createdAt,
      currency: "INR",
      orderId: order.id,
      razorpayOrderId: `order_seed_${index + 1}`,
      razorpayPaymentId: `pay_seed_${index + 1}`,
      status: "captured",
      updatedAt: createdAt,
    });

    orderCount += 1;
  }

  console.log(`  ${orderCount} historical paid orders`);

  // ------------------------------------------------------- cancellations
  //
  // The failure trail is what `getCancellationSummary` reads, and a merchant
  // agent asked "why are we losing orders" needs a real distribution of
  // reasons rather than a count of zero.
  let cancelledCount = 0;

  for (const [index, entry] of PC_CANCELLATIONS.entries()) {
    const lines = entry.skus
      .map((sku) => bySku.get(sku))
      .filter((product): product is NonNullable<typeof product> =>
        Boolean(product)
      );

    if (lines.length === 0) {
      continue;
    }

    const subtotal = lines.reduce((total, product) => total + product.price, 0);
    const createdAt = daysAgo(entry.daysAgo);

    const [order] = await db
      .insert(orders)
      .values({
        approvalStatus: "approved",
        buyerIdentifier: `lapsed${index + 1}@example.com`,
        buyerType: "human",
        createdAt,
        currency: "INR",
        merchantId: merchant.id,
        orderStatus: entry.status,
        subtotal,
        totalAmount: subtotal,
        updatedAt: createdAt,
      })
      .returning();

    if (!order) {
      continue;
    }

    await db.insert(orderItems).values(
      lines.map((product) => ({
        orderId: order.id,
        productId: product.id,
        quantity: 1,
        subtotal: product.price,
        unitPrice: product.price,
      }))
    );

    // The failure lives in the agent database, which is where the trail of
    // what went wrong belongs (§15).
    await agentDb.insert(failures).values({
      createdAt,
      errorMessage: entry.errorMessage,
      errorType: entry.errorType,
      orderId: order.id,
      recoveryAction: entry.recoveryAction,
    });

    cancelledCount += 1;
  }

  console.log(`  ${cancelledCount} cancelled or failed orders, with reasons`);
  console.log("");
  console.log("Done.");
  console.log(`  Store:    http://localhost:3000/store/${STORE_SLUG}`);
  console.log(
    `  Catalog:  http://localhost:3000/store/${STORE_SLUG}/catalog.json`
  );
  console.log(`  Merchant: ${OWNER_EMAIL} / ${OWNER_PASSWORD}`);
  console.log("");
  console.log("Next: bun run embed   (optional, enables semantic search)");

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
