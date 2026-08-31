import { campaigns, db } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { resolveActor } from "@/lib/api/actor";
import { assertMerchantOwner } from "@/lib/api/merchant";
import { handleRouteError, ok, unauthorized } from "@/lib/api/respond";

const bodySchema = z.object({
  description: z.string().max(1000).optional(),
  discountType: z.enum(["percentage", "flat", "bundle"]),
  discountValue: z.number().int().positive(),
  merchantId: z.uuid(),
  reason: z.string().max(2000).optional(),
  title: z.string().min(3).max(120),
  triggerRules: z.record(z.string(), z.unknown()).optional(),
});

/** GET /api/campaigns?merchantId=... */
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
      .select()
      .from(campaigns)
      .where(eq(campaigns.merchantId, merchantId))
      .orderBy(desc(campaigns.createdAt));

    return ok(rows);
  } catch (error) {
    return handleRouteError(error);
  }
}

/** POST /api/campaigns — a merchant-authored campaign, created as a draft. */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const actor = await resolveActor(request);

    if (!actor) {
      return unauthorized();
    }

    const body = bodySchema.parse(await request.json());

    await assertMerchantOwner(actor, body.merchantId);

    const [campaign] = await db
      .insert(campaigns)
      .values({
        aiGeneratedReason: body.reason ?? null,
        description: body.description ?? null,
        discountType: body.discountType,
        discountValue: body.discountValue,
        merchantId: body.merchantId,
        status: "draft",
        title: body.title,
        triggerRules: body.triggerRules,
      })
      .returning();

    return ok(campaign, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
