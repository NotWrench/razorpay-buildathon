import { backfillEmbeddings } from "@workspace/ai";
import { db, products } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { resolveActor } from "@/lib/api/actor";
import { assertMerchantOwner } from "@/lib/api/merchant";
import { handleRouteError, ok, unauthorized } from "@/lib/api/respond";

const productSchema = z.object({
  attributes: z.record(z.string(), z.unknown()).optional(),
  brand: z.string().max(120).optional(),
  category: z.string().max(120).optional(),
  description: z.string().max(4000).optional(),
  imageUrl: z.url().optional(),
  merchantId: z.uuid(),
  name: z.string().min(2).max(200),
  /** Smallest currency unit. ₹4,999 is 499900. */
  price: z.number().int().positive(),
  sku: z.string().max(80).optional(),
  stock: z.number().int().min(0).default(0),
});

/** GET /api/products?merchantId=... — the merchant's catalog. */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const actor = await resolveActor(request);

    if (!actor) {
      return unauthorized();
    }

    const merchantId = new URL(request.url).searchParams.get("merchantId");

    if (!merchantId) {
      return ok([]);
    }

    await assertMerchantOwner(actor, merchantId);

    const rows = await db
      .select({
        brand: products.brand,
        category: products.category,
        description: products.description,
        id: products.id,
        imageUrl: products.imageUrl,
        isActive: products.isActive,
        name: products.name,
        price: products.price,
        sku: products.sku,
        stock: products.stock,
      })
      .from(products)
      .where(eq(products.merchantId, merchantId))
      .orderBy(desc(products.createdAt));

    return ok(rows);
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * POST /api/products
 *
 * Adds a product and embeds it immediately, so it is semantically searchable
 * the moment it exists rather than after a separate backfill.
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const actor = await resolveActor(request);

    if (!actor) {
      return unauthorized();
    }

    const body = productSchema.parse(await request.json());

    await assertMerchantOwner(actor, body.merchantId);

    const [product] = await db
      .insert(products)
      .values({
        attributes: body.attributes,
        brand: body.brand,
        category: body.category,
        description: body.description,
        imageUrl: body.imageUrl,
        merchantId: body.merchantId,
        name: body.name,
        price: body.price,
        sku: body.sku,
        stock: body.stock,
      })
      .returning();

    // Embedding is best-effort: a product that exists but is only lexically
    // searchable beats a failed create.
    backfillEmbeddings({ merchantId: body.merchantId }).catch((error) => {
      console.error("Embedding backfill failed after product create", error);
    });

    return ok(product, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
