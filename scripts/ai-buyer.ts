/**
 * A reference autonomous buyer.
 *
 * This script is deliberately outside the application: it has no database
 * access, no imports from `@workspace/*`, and no privileged knowledge. It knows
 * one URL and an API key, and everything else it discovers over HTTP the way a
 * third-party buying agent would.
 *
 * That constraint is the point. If this works, the merchant is genuinely
 * transactable by an AI buyer — not merely transactable by *our* AI.
 *
 *   bun run ai-buyer -- --budget 30000 --want "a graphics card for 1440p gaming"
 *
 * Requires AI_BUYER_API_KEY (issue one from the merchant dashboard).
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const API_KEY = process.env.AI_BUYER_API_KEY;
const STORE_SLUG = process.env.AI_BUYER_STORE_SLUG ?? "nova-electronics";

const POLL_INTERVAL_MS = 3000;
const POLL_ATTEMPTS = 100;

interface CatalogProduct {
  brand: string | null;
  category: string | null;
  description: string | null;
  id: string;
  in_stock: boolean;
  name: string;
  price_paise: number;
}

interface Manifest {
  endpoints: {
    create_order: string;
    /** Present once a deployment supports buyer-side delegation. */
    mandates?: string;
    order_status: string;
    pay?: string;
    payment_link: string;
  };
  /** The buyer's own bounds, when this deployment publishes them. */
  mandates?: { note: string; refusals: string[] };
  policy: { approval_required: boolean; per_conversation_cap_paise: number };
  stores: { catalog: string; name: string; slug: string }[];
}

function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);

  return index === -1 ? undefined : process.argv[index + 1];
}

function log(step: string, message: string) {
  console.log(`\n[${step}] ${message}`);
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(API_KEY ? { "x-api-key": API_KEY } : {}),
      ...init?.headers,
    },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const detail =
      (body as { error?: { message?: string } } | null)?.error?.message ??
      response.statusText;

    throw new Error(`${response.status} ${url} — ${detail}`);
  }

  return body as T;
}

/**
 * Picks a product on stated criteria.
 *
 * No model is called here on purpose: a buying agent's *selection* logic is its
 * own business, and hard-coding a transparent rule keeps the demo about the
 * commerce protocol rather than about the reasoning.
 */
function choose(
  products: CatalogProduct[],
  want: string,
  budgetPaise: number
): CatalogProduct | undefined {
  const terms = want
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  const scored = products
    .filter((product) => product.in_stock && product.price_paise <= budgetPaise)
    .map((product) => {
      const haystack =
        `${product.name} ${product.brand ?? ""} ${product.category ?? ""} ${product.description ?? ""}`.toLowerCase();

      return {
        product,
        score: terms.filter((term) => haystack.includes(term)).length,
      };
    })
    .filter((row) => row.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || b.product.price_paise - a.product.price_paise
    );

  return scored[0]?.product;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  if (!API_KEY) {
    console.error(
      "AI_BUYER_API_KEY is not set. Issue an API key from the merchant dashboard and put it in .env."
    );
    process.exit(1);
  }

  const want = argValue("--want") ?? "a graphics card for 1440p gaming";
  const budgetPaise = Number(argValue("--budget") ?? 25_000) * 100;

  console.log("Autonomous buyer starting.");
  console.log(`  Looking for: ${want}`);
  console.log(`  Budget:      ${rupees(budgetPaise)}`);

  // 1. Discovery — find out what this merchant supports before assuming.
  log("1/6", "Reading the agent manifest...");

  const manifest = await getJson<Manifest>(
    `${APP_URL}/.well-known/agent-commerce.json`
  );

  const store =
    manifest.stores.find((entry) => entry.slug === STORE_SLUG) ??
    manifest.stores[0];

  if (!store) {
    throw new Error("The manifest lists no stores.");
  }

  console.log(`      Store: ${store.name}`);
  console.log(
    `      Approval required: ${manifest.policy.approval_required ? "yes — a human merchant must approve" : "no"}`
  );

  // 2. Catalog.
  log("2/6", `Reading ${store.catalog}...`);

  const catalog = await getJson<{ products: CatalogProduct[] }>(store.catalog);

  console.log(`      ${catalog.products.length} products listed`);

  // 3. Selection.
  log("3/6", "Choosing...");

  const chosen = choose(catalog.products, want, budgetPaise);

  if (!chosen) {
    console.log(
      `      Nothing matching "${want}" under ${rupees(budgetPaise)}. Stopping without buying.`
    );
    process.exit(0);
  }

  console.log(`      ${chosen.name} at ${rupees(chosen.price_paise)}`);

  // 4. Order — with a stated reason, because the merchant will read it.
  log("4/6", "Creating the order...");

  const reason =
    `Autonomous purchase: buyer agent searched for "${want}" with a budget of ` +
    `${rupees(budgetPaise)} and selected ${chosen.name} at ${rupees(chosen.price_paise)} ` +
    "as the closest in-stock match within budget.";

  const created = await getJson<{
    data: {
      order: { approvalStatus: string; id: string; totalAmount: number };
    };
  }>(`${APP_URL}/api/payments/orders`, {
    body: JSON.stringify({
      aiPurchaseReason: reason,
      items: [{ productId: chosen.id, quantity: 1 }],
      merchantId: catalogMerchantId(store.catalog, catalog),
    }),
    method: "POST",
  });

  const order = created.data.order;

  console.log(`      Order ${order.id} created: ${order.approvalStatus}`);
  console.log("      Nothing has been charged.");

  // 5. Wait for the human.
  log("5/6", "Waiting for the merchant to approve...");
  console.log(
    "      (approve it in the dashboard — this agent cannot approve itself)"
  );

  let approved = false;

  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    await sleep(POLL_INTERVAL_MS);

    const status = await getJson<{
      data: { order: { approvalStatus: string; orderStatus: string } };
    }>(`${APP_URL}/api/payments/orders/${order.id}`);

    const current = status.data.order;

    if (current.approvalStatus === "approved") {
      approved = true;
      break;
    }

    if (current.approvalStatus === "rejected") {
      console.log("      The merchant rejected this order. Stopping.");
      process.exit(0);
    }

    process.stdout.write(".");
  }

  if (!approved) {
    console.log(
      "\n      Timed out waiting for approval. The order is still pending."
    );
    process.exit(0);
  }

  console.log("\n      Approved by the merchant.");

  /*
   * 6. Pay.
   *
   * This step used to print a URL and stop, which is where "transactable by an
   * AI buyer end to end" stopped being true. Whether it can be done without a
   * person is not assumed: the manifest says whether this deployment supports
   * buyer-side delegation, and the script asks before trying — which is the
   * whole point of publishing bounds rather than only enforcing them.
   *
   * A refusal is not a crash. Every one of them has the same remedy, and the
   * script takes it: fall back to the link a human can open, and say why.
   */
  if (!manifest.endpoints.pay) {
    log("6/6", "This deployment has no unattended payment. Asking for a link...");

    await handOff(order.id);

    return;
  }

  log("6/6", "Paying from the buyer's standing authorisation...");

  const paid = await fetch(`${APP_URL}/api/payments/pay`, {
    body: JSON.stringify({ orderId: order.id }),
    headers: { "content-type": "application/json", "x-api-key": API_KEY },
    method: "POST",
  });

  const settlement = (await paid.json()) as {
    data?: {
      message: string;
      remainingPaise: number;
      simulated: boolean;
      totalPaise: number;
    };
    error?: { code: string; message: string };
  };

  const result = settlement.data;

  if (!(paid.ok && result)) {
    const error = settlement.error;

    console.log(`      Refused: ${error?.code ?? paid.status}`);
    console.log(`      ${error?.message ?? "No reason given."}`);
    console.log("      Nothing was charged. Falling back to a payment link.");

    await handOff(order.id);

    return;
  }

  console.log("");
  console.log(`Done. Paid ${rupees(result.totalPaise)} with nobody watching.`);
  console.log(`  ${result.message}`);

  if (result.simulated) {
    console.log(
      "  Settled through the simulated instrument — this store has no Razorpay"
    );
    console.log(
      "  recurring entitlement, and the payment record says so rather than"
    );
    console.log("  pretending otherwise.");
  }

  console.log("");
  console.log(`Audit trail: ${APP_URL}/api/agent/trace/${order.id}`);

  process.exit(0);
}

/**
 * The fallback, and the end of the run.
 *
 * A payment link is the honest answer whenever the agent may not pay: the
 * purchase is real, the order stands, and a person can finish it.
 */
async function handOff(orderId: string): Promise<void> {
  const link = await getJson<{ data: { paymentLinkUrl: string } }>(
    `${APP_URL}/api/payments/links`,
    { body: JSON.stringify({ orderId }), method: "POST" }
  );

  console.log("");
  console.log("Payment link for the human to complete:");
  console.log(`  ${link.data.paymentLinkUrl}`);
  console.log("");
  console.log(`Audit trail: ${APP_URL}/api/agent/trace/${orderId}`);

  process.exit(0);
}

/** The catalog document carries the merchant id the order endpoint needs. */
function catalogMerchantId(
  _catalogUrl: string,
  catalog: { merchant?: { id: string } } & { products: CatalogProduct[] }
): string {
  const id = catalog.merchant?.id;

  if (!id) {
    throw new Error("The catalog did not identify its merchant.");
  }

  return id;
}

main().catch((error) => {
  console.error(`\nFailed: ${error.message}`);
  process.exit(1);
});
