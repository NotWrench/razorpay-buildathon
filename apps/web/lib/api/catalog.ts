import { createHash } from "node:crypto";
import {
  type CatalogReadinessNote,
  getCatalogReadiness,
  getMerchantBySlug,
  listCatalogRows,
  toCatalogEntry,
} from "@workspace/ai";

/**
 * The catalog an AI buyer reads.
 *
 * Shared by the clean `/store/[slug]/catalog.json` path and its `/api`-prefixed
 * twin so both serve byte-identical documents, including the ETag.
 *
 * It used to publish `attributes` — the free-form display blob — and nothing
 * from `product_specs`, which meant the one table built to be validated against
 * never left the building. A buying agent could read a price and a name and had
 * no way to tell whether a cooler fitted the socket, while the merchant's own
 * readiness screen told them their catalogue was invisible to AI buyers for
 * exactly that reason. Both halves of that contradiction are closed here: the
 * typed specs travel with the product, and so does the readiness score.
 */

const MAX_PAGE_SIZE = 200;

const COMPLETE: CatalogReadinessNote = {
  blocked: false,
  missing: [],
  score: 100,
};

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

  const [rows, readiness] = await Promise.all([
    listCatalogRows(merchant.id, { limit, offset }),
    getCatalogReadiness(merchant.id),
  ]);

  /*
   * `needsWork` holds only the products with a gap, so anything absent from it
   * scored perfectly. Defaulting to 100 rather than treating a miss as unknown
   * keeps the two views consistent: a product the merchant's screen does not
   * list as needing work is one this document should not flag either.
   */
  const scores = new Map<string, CatalogReadinessNote>(
    readiness.needsWork.map((product) => [
      product.productId,
      {
        blocked: product.blocked,
        missing: product.gaps.map((gap) => gap.field),
        score: product.score,
      },
    ])
  );

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
    /*
     * Named here as well as in the discovery manifest. An agent that reached
     * this document directly — from a link, a cache, a previous crawl — should
     * not have to go back to `/.well-known` to learn that it can ask whether
     * two of these parts fit together.
     */
    compatibility: {
      body: { items: [{ productId: "<uuid>", quantity: 1 }] },
      method: "POST",
      note: "Deterministic, not a model. Returns a status per rule, including insufficient_data where a specification below is null — which is never the same answer as compatible.",
      url: `${origin}/api/store/${merchant.storeSlug}/compatibility`,
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
    products: rows.map((row) =>
      toCatalogEntry(
        row,
        merchant.currency,
        scores.get(row.product.id) ?? COMPLETE
      )
    ),
    /*
     * A null spec is a fact, not an omission. Said out loud because the
     * cheapest wrong assumption a buying agent can make about this document is
     * that a missing field means "does not apply".
     */
    specs_note:
      "A null specification means the merchant has not recorded it. It is not zero and it is not 'not applicable' — the compatibility engine answers insufficient_data on it rather than compatible. `readiness` says which fields are missing and whether their absence blocks a recommendation.",
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
