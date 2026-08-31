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
 *   bun run seed
 */

import { auth } from "@workspace/auth";
import {
  CATEGORY_DEFINITIONS,
  db,
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
import { eq } from "drizzle-orm";
import { PC_CATALOG, PC_ORDER_HISTORY } from "./data/pc-catalog";

const STORE_SLUG = "nova-electronics";
const OWNER_EMAIL = "merchant@example.com";
const OWNER_PASSWORD = "demo-password-123";

function daysAgo(days: number): Date {
  const date = new Date();

  date.setDate(date.getDate() - days);

  return date;
}

async function ensureOwner(): Promise<string> {
  const existing = await db.query.user.findFirst({
    where: eq(user.email, OWNER_EMAIL),
  });

  if (existing) {
    return existing.id;
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

async function main() {
  console.log("Seeding demo store...");

  const userId = await ensureOwner();

  const existingMerchant = await db.query.merchants.findFirst({
    where: eq(merchants.storeSlug, STORE_SLUG),
  });

  if (existingMerchant) {
    console.log(
      `Store "${STORE_SLUG}" already exists (${existingMerchant.id}). Delete it first to reseed.`
    );
    process.exit(0);
  }

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
          description: item.description,
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
