import { createHash } from "node:crypto";
import {
  getMerchantBySlug,
  listActiveProducts,
  toCatalogEntry,
} from "@workspace/ai";

/**
 * The catalog an AI buyer reads.
 *
 * Shared by the clean `/store/[slug]/catalog.json` path and its `/api`-prefixed
 * twin so both serve byte-identical documents, including the ETag.
 */

const MAX_PAGE_SIZE = 200;

export async function buildCatalogResponse(
  slug: string,
  request: Request
): Promise<Response> {
  const merchant = await getMerchantBySlug(slug);
  const url = new URL(request.url);

  const limit = Math.min(
    Number.parseInt(url.searchParams.get("limit") ?? "100", 10) || 100,
    MAX_PAGE_SIZE
  );
  const offset = Math.max(
    Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0,
    0
  );

  const rows = await listActiveProducts(merchant.id, { limit, offset });
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;

  const document = {
    checkout: {
      // Exactly the call an AI buyer should make, so it never has to guess.
      approval:
        "Agent orders are created as pending_approval and charge nothing. The merchant must approve before payment is possible.",
      auth: "Send your API key in the x-api-key header.",
      body: {
        aiPurchaseReason:
          "Required. Why you are buying this, in plain language.",
        items: [{ productId: "<uuid>", quantity: 1 }],
        merchantId: merchant.id,
      },
      method: "POST",
      payment_link: `${origin}/api/payments/links`,
      status: `${origin}/api/payments/orders/{orderId}`,
      url: `${origin}/api/payments/orders`,
    },
    currency: merchant.currency,
    generated_at: new Date().toISOString(),
    merchant: {
      id: merchant.id,
      name: merchant.businessName,
      slug: merchant.storeSlug,
    },
    pagination: { limit, offset, returned: rows.length },
    price_unit: "paise",
    products: rows.map((product) => toCatalogEntry(product, merchant.currency)),
  };

  const body = JSON.stringify(document, null, 2);

  // Hash the products rather than the whole document: `generated_at` changes on
  // every request and would defeat caching entirely.
  const etag = `"${createHash("sha256").update(JSON.stringify(document.products)).digest("hex").slice(0, 32)}"`;

  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { headers: { etag }, status: 304 });
  }

  return new Response(body, {
    headers: {
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
      "content-type": "application/json; charset=utf-8",
      etag,
    },
  });
}
