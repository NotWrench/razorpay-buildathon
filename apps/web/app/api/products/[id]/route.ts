import { backfillEmbeddings } from "@workspace/ai";
import { db, products } from "@workspace/db";
import { PaymentError } from "@workspace/payments";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { resolveActor } from "@/lib/api/actor";
import { assertMerchantOwner } from "@/lib/api/merchant";
import { handleRouteError, ok, unauthorized } from "@/lib/api/respond";

const updateSchema = z.object({
  attributes: z.record(z.string(), z.unknown()).optional(),
  brand: z.string().max(120).nullish(),
  category: z.string().max(120).nullish(),
  description: z.string().max(4000).nullish(),
  imageUrl: z.url().nullish(),
  isActive: z.boolean().optional(),
  name: z.string().min(2).max(200).optional(),
  price: z.number().int().positive().optional(),
  sku: z.string().max(80).nullish(),
  stock: z.number().int().min(0).optional(),
});

async function loadOwnedProduct(request: NextRequest, productId: string) {
  const actor = await resolveActor(request);

  if (!actor) {
    return null;
  }

  const product = await db.query.products.findFirst({
    where: eq(products.id, productId),
  });

  if (!product) {
    throw new PaymentError(
      "PRODUCT_NOT_FOUND",
      `No product found for ${productId}`
    );
  }

  await assertMerchantOwner(actor, product.merchantId);

  return product;
}

/** PATCH /api/products/{id} */
export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/products/[id]">
): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const product = await loadOwnedProduct(request, id);

    if (!product) {
      return unauthorized();
    }

    const body = updateSchema.parse(await request.json());

    const [updated] = await db
      .update(products)
      .set(body)
      .where(eq(products.id, id))
      .returning();

    // Text changed means the stored embedding is now wrong; re-embed rather
    // than leave semantic search pointing at the old description.
    if (body.name || body.description || body.brand || body.category) {
      backfillEmbeddings({ force: true, merchantId: product.merchantId }).catch(
        (error) => {
          console.error("Re-embedding failed after product update", error);
        }
      );
    }

    return ok(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * DELETE /api/products/{id}
 *
 * Soft delete. `order_items` references products with `onDelete: restrict`, so
 * a sold product cannot be removed without destroying order history —
 * deactivating hides it from the catalog and every agent while keeping the
 * books intact.
 */
export async function DELETE(
  request: NextRequest,
  ctx: RouteContext<"/api/products/[id]">
): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const product = await loadOwnedProduct(request, id);

    if (!product) {
      return unauthorized();
    }

    await db
      .update(products)
      .set({ isActive: false })
      .where(eq(products.id, id));

    return ok({ deactivated: true, id });
  } catch (error) {
    return handleRouteError(error);
  }
}
