import { db, merchants } from "@workspace/db";
import { PaymentError } from "@workspace/payments";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { resolveActor } from "@/lib/api/actor";
import { handleRouteError, ok, unauthorized } from "@/lib/api/respond";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const bodySchema = z.object({
  businessName: z.string().min(2).max(160),
  currency: z.string().length(3).default("INR"),
  storeSlug: z
    .string()
    .min(2)
    .max(60)
    .regex(SLUG_PATTERN, "Use lowercase letters, numbers and hyphens"),
});

/** GET /api/merchants — the stores owned by the signed-in user. */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const actor = await resolveActor(request);

    if (!actor?.userId) {
      return unauthorized();
    }

    const rows = await db
      .select({
        businessName: merchants.businessName,
        currency: merchants.currency,
        id: merchants.id,
        razorpayConnected: merchants.razorpayKeyId,
        storeSlug: merchants.storeSlug,
      })
      .from(merchants)
      .where(eq(merchants.userId, actor.userId));

    return ok(
      rows.map((row) => ({
        ...row,
        razorpayConnected: Boolean(row.razorpayConnected),
      }))
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * POST /api/merchants
 *
 * Onboards a store for the signed-in user. The slug is the storefront address
 * and the key an AI buyer uses to find the catalog, so it is unique and
 * immutable once taken.
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const actor = await resolveActor(request);

    if (!actor?.userId || actor.type !== "human") {
      return unauthorized();
    }

    const body = bodySchema.parse(await request.json());

    const existing = await db.query.merchants.findFirst({
      where: eq(merchants.storeSlug, body.storeSlug),
    });

    if (existing) {
      throw new PaymentError(
        "MERCHANT_NOT_FOUND",
        `The store address "${body.storeSlug}" is already taken`
      );
    }

    const [merchant] = await db
      .insert(merchants)
      .values({
        businessName: body.businessName,
        currency: body.currency,
        storeSlug: body.storeSlug,
        userId: actor.userId,
      })
      .returning();

    return ok(merchant, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
