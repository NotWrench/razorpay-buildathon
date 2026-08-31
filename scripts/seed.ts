/**
 * Seeds a demo store: one merchant, a catalog across five categories, and a
 * back-history of paid orders.
 *
 * The order history is the point. Attach rates, slow movers and cross-sell
 * suggestions are all computed from real `order_items` rows, so without a
 * plausible history the merchant agent has nothing true to say. The history
 * here is deliberately lopsided — laptops sell, sleeves do not — so the bundle
 * recommendation the demo leans on is a real finding rather than a fixture.
 *
 *   bun run seed
 */

import { auth } from "@workspace/auth";
import {
  db,
  merchants,
  orderItems,
  orders,
  payments,
  products,
  user,
} from "@workspace/db";
import { eq } from "drizzle-orm";

const STORE_SLUG = "nova-electronics";
const OWNER_EMAIL = "merchant@example.com";
const OWNER_PASSWORD = "demo-password-123";

interface SeedProduct {
  attributes?: Record<string, unknown>;
  brand: string;
  category: string;
  description: string;
  name: string;
  /** Rupees; converted to paise on insert. */
  priceRupees: number;
  sku: string;
  stock: number;
}

const CATALOG: SeedProduct[] = [
  // Laptops — the anchors.
  {
    attributes: { ram: "16GB", screen: "14 inch", weight: "1.24kg" },
    brand: "Dell",
    category: "Laptops",
    description:
      "14-inch ultrabook with a 16GB configuration, all-day battery and a backlit keyboard. Built for people who work on trains.",
    name: "Dell XPS 14",
    priceRupees: 134_990,
    sku: "LAP-DELL-XPS14",
    stock: 12,
  },
  {
    attributes: { ram: "16GB", screen: "13.6 inch", weight: "1.24kg" },
    brand: "Apple",
    category: "Laptops",
    description:
      "Fanless 13-inch laptop, silent under load, with an 18-hour battery. The default choice for writing and light development.",
    name: "MacBook Air M3",
    priceRupees: 114_900,
    sku: "LAP-APPL-MBA13",
    stock: 9,
  },
  {
    attributes: { ram: "16GB", screen: "14 inch" },
    brand: "Lenovo",
    category: "Laptops",
    description:
      "Business laptop with a legendary keyboard, a matte display and a chassis rated for accidental abuse.",
    name: "Lenovo ThinkPad T14",
    priceRupees: 98_500,
    sku: "LAP-LENO-T14",
    stock: 15,
  },

  // Laptop accessories — the slow movers the campaign should find.
  {
    attributes: { fits: "14 inch", material: "recycled felt" },
    brand: "Nova",
    category: "Accessories",
    description:
      "Slim felt sleeve for 14-inch laptops. Water resistant, with a magnetic closure and no branding on the outside.",
    name: "Nova Felt Laptop Sleeve 14",
    priceRupees: 1999,
    sku: "ACC-NOVA-SLV14",
    stock: 84,
  },
  {
    attributes: { ports: "7-in-1" },
    brand: "Anker",
    category: "Accessories",
    description:
      "7-in-1 USB-C hub: HDMI, two USB-A, SD, microSD and 100W pass-through charging. Aluminium body.",
    name: "Anker 7-in-1 USB-C Hub",
    priceRupees: 4499,
    sku: "ACC-ANKR-HUB7",
    stock: 46,
  },
  {
    attributes: { layout: "75%", switches: "brown" },
    brand: "Keychron",
    category: "Accessories",
    description:
      "75% mechanical keyboard with hot-swappable brown switches and Bluetooth for three devices.",
    name: "Keychron K3 Pro",
    priceRupees: 8999,
    sku: "ACC-KEYC-K3P",
    stock: 38,
  },
  {
    attributes: { dpi: 4000 },
    brand: "Logitech",
    category: "Accessories",
    description:
      "Quiet wireless mouse with a sculpted shape and a two-month battery. Pairs with up to three machines.",
    name: "Logitech MX Anywhere 3S",
    priceRupees: 7495,
    sku: "ACC-LOGI-MX3S",
    stock: 52,
  },

  // Headphones — the buyer-journey category.
  {
    attributes: { anc: true, battery: "30h" },
    brand: "Sony",
    category: "Headphones",
    description:
      "Over-ear headphones with best-in-class active noise cancellation, 30-hour battery and multipoint pairing. The reference choice for flights.",
    name: "Sony WH-1000XM5",
    priceRupees: 24_990,
    sku: "AUD-SONY-XM5",
    stock: 22,
  },
  {
    attributes: { anc: true, battery: "24h" },
    brand: "Bose",
    category: "Headphones",
    description:
      "Comfort-first over-ear headphones with strong noise cancellation and a light clamp for long sessions.",
    name: "Bose QuietComfort Ultra",
    priceRupees: 27_900,
    sku: "AUD-BOSE-QCU",
    stock: 14,
  },
  {
    attributes: { anc: true, form: "in-ear" },
    brand: "Sony",
    category: "Headphones",
    description:
      "In-ear noise cancelling buds with the same processor as the XM5, in a pocketable case.",
    name: "Sony WF-1000XM5 Earbuds",
    priceRupees: 19_990,
    sku: "AUD-SONY-WF5",
    stock: 30,
  },
  {
    attributes: { anc: false, battery: "40h" },
    brand: "Sennheiser",
    category: "Headphones",
    description:
      "Open-back wired headphones for listening at a desk. No noise cancellation, considerably better sound.",
    name: "Sennheiser HD 599",
    priceRupees: 14_990,
    sku: "AUD-SENN-599",
    stock: 18,
  },
  {
    attributes: { anc: true, budget: true },
    brand: "Soundcore",
    category: "Headphones",
    description:
      "Budget over-ear headphones with decent noise cancellation and a 50-hour battery. The sensible choice under twenty thousand.",
    name: "Soundcore Space One",
    priceRupees: 8499,
    sku: "AUD-SNDC-SP1",
    stock: 40,
  },

  // Headphone accessories — cross-sell candidates.
  {
    attributes: { fits: "over-ear" },
    brand: "Nova",
    category: "Accessories",
    description:
      "Hard-shell carry case sized for over-ear headphones, with a cable pocket and a carabiner loop.",
    name: "Nova Headphone Case",
    priceRupees: 1499,
    sku: "ACC-NOVA-HPC",
    stock: 76,
  },
  {
    attributes: { length: "1.2m" },
    brand: "Nova",
    category: "Accessories",
    description:
      "Braided 3.5mm audio cable with an inline mic, for wired listening when the battery runs out.",
    name: "Nova 3.5mm Audio Cable",
    priceRupees: 799,
    sku: "ACC-NOVA-CBL35",
    stock: 120,
  },

  // Monitors.
  {
    attributes: { resolution: "4K", size: "27 inch" },
    brand: "LG",
    category: "Monitors",
    description:
      "27-inch 4K IPS monitor with USB-C charging at 90W, so one cable carries video and power.",
    name: "LG 27UP850N 4K",
    priceRupees: 42_999,
    sku: "MON-LG-27UP",
    stock: 11,
  },
  {
    attributes: { refresh: "180Hz", resolution: "1440p" },
    brand: "Dell",
    category: "Monitors",
    description:
      "27-inch 1440p monitor at 180Hz with a height-adjustable stand. Fast enough for games, calm enough for work.",
    name: "Dell S2725DS",
    priceRupees: 23_499,
    sku: "MON-DELL-S27",
    stock: 17,
  },

  // Storage.
  {
    attributes: { capacity: "1TB", speed: "1050MB/s" },
    brand: "Samsung",
    category: "Storage",
    description:
      "1TB portable SSD, shock resistant and roughly the size of a credit card. USB-C at 1050MB/s.",
    name: "Samsung T7 Shield 1TB",
    priceRupees: 9499,
    sku: "STO-SAMS-T7S",
    stock: 33,
  },
  {
    attributes: { capacity: "2TB", form: "NVMe" },
    brand: "WD",
    category: "Storage",
    description:
      "2TB NVMe drive for upgrading a laptop or console. Five-year warranty.",
    name: "WD Black SN850X 2TB",
    priceRupees: 15_999,
    sku: "STO-WD-850X",
    stock: 24,
  },
];

/**
 * Historical orders, expressed as SKUs so the intent is readable.
 *
 * Laptops are frequently bought with the hub and the keyboard, and almost never
 * with the sleeve — which is exactly the 4%-attach-rate finding the merchant
 * agent is meant to surface.
 */
const ORDER_HISTORY: { daysAgo: number; skus: string[] }[] = [
  { daysAgo: 2, skus: ["LAP-DELL-XPS14", "ACC-ANKR-HUB7"] },
  { daysAgo: 3, skus: ["LAP-DELL-XPS14", "ACC-KEYC-K3P"] },
  { daysAgo: 4, skus: ["LAP-APPL-MBA13", "ACC-ANKR-HUB7", "ACC-LOGI-MX3S"] },
  { daysAgo: 5, skus: ["LAP-LENO-T14", "ACC-ANKR-HUB7"] },
  { daysAgo: 6, skus: ["LAP-APPL-MBA13", "ACC-KEYC-K3P"] },
  { daysAgo: 7, skus: ["LAP-DELL-XPS14", "MON-DELL-S27"] },
  { daysAgo: 8, skus: ["LAP-LENO-T14", "ACC-LOGI-MX3S"] },
  { daysAgo: 9, skus: ["LAP-APPL-MBA13"] },
  { daysAgo: 10, skus: ["LAP-DELL-XPS14", "ACC-ANKR-HUB7"] },
  { daysAgo: 11, skus: ["LAP-LENO-T14", "ACC-NOVA-SLV14"] }, // the rare sleeve sale
  { daysAgo: 12, skus: ["LAP-APPL-MBA13", "MON-LG-27UP"] },
  { daysAgo: 13, skus: ["LAP-DELL-XPS14", "ACC-KEYC-K3P", "ACC-LOGI-MX3S"] },
  { daysAgo: 14, skus: ["LAP-LENO-T14"] },
  { daysAgo: 15, skus: ["LAP-APPL-MBA13", "ACC-ANKR-HUB7"] },
  { daysAgo: 16, skus: ["LAP-DELL-XPS14"] },
  { daysAgo: 17, skus: ["LAP-LENO-T14", "ACC-KEYC-K3P"] },

  // Headphones, with the case attaching reasonably often.
  { daysAgo: 2, skus: ["AUD-SONY-XM5", "ACC-NOVA-HPC"] },
  { daysAgo: 3, skus: ["AUD-SONY-XM5"] },
  { daysAgo: 4, skus: ["AUD-BOSE-QCU", "ACC-NOVA-HPC"] },
  { daysAgo: 5, skus: ["AUD-SONY-XM5", "ACC-NOVA-CBL35"] },
  { daysAgo: 6, skus: ["AUD-SONY-WF5"] },
  { daysAgo: 7, skus: ["AUD-SONY-XM5", "ACC-NOVA-HPC"] },
  { daysAgo: 8, skus: ["AUD-SNDC-SP1"] },
  { daysAgo: 9, skus: ["AUD-SONY-XM5"] },
  { daysAgo: 10, skus: ["AUD-BOSE-QCU"] },
  { daysAgo: 12, skus: ["AUD-SONY-WF5", "ACC-NOVA-CBL35"] },
  { daysAgo: 14, skus: ["AUD-SENN-599"] },
  { daysAgo: 18, skus: ["AUD-SONY-XM5", "ACC-NOVA-HPC"] },

  { daysAgo: 20, skus: ["STO-SAMS-T7S"] },
  { daysAgo: 21, skus: ["MON-LG-27UP", "ACC-ANKR-HUB7"] },
  { daysAgo: 22, skus: ["STO-WD-850X"] },
];

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
      name: "Nova Electronics",
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
      businessName: "Nova Electronics",
      currency: "INR",
      storeSlug: STORE_SLUG,
      userId,
    })
    .returning();

  if (!merchant) {
    throw new Error("Failed to create the merchant");
  }

  const inserted = await db
    .insert(products)
    .values(
      CATALOG.map((item) => ({
        attributes: item.attributes,
        brand: item.brand,
        category: item.category,
        description: item.description,
        merchantId: merchant.id,
        name: item.name,
        price: item.priceRupees * 100,
        sku: item.sku,
        stock: item.stock,
      }))
    )
    .returning();

  const bySku = new Map(inserted.map((row) => [row.sku ?? "", row]));

  console.log(`  ${inserted.length} products`);

  let orderCount = 0;

  for (const [index, historical] of ORDER_HISTORY.entries()) {
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
