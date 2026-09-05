import type { NextRequest } from "next/server";
import { resolveActor } from "@/lib/api/actor";
import { revokeAgentKey } from "@/lib/api/agent-keys";
import { assertMerchantOwner } from "@/lib/api/merchant";
import { fail, handleRouteError, ok, unauthorized } from "@/lib/api/respond";

/**
 * DELETE /api/merchants/agent-keys/{keyId}?merchantId=...
 *
 * Revokes a key. It is disabled rather than deleted, because the orders it
 * placed still name it — a merchant asking what an agent bought before they
 * cut it off should get an answer rather than an unresolvable id.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
): Promise<Response> {
  try {
    const actor = await resolveActor(request);

    if (!actor) {
      return unauthorized();
    }

    const merchantId = new URL(request.url).searchParams.get("merchantId");

    if (!merchantId) {
      return fail("VALIDATION_ERROR", "merchantId is required", 400);
    }

    await assertMerchantOwner(actor, merchantId);

    const { keyId } = await params;

    /*
     * A key belonging to another store answers "no such key", not "not
     * yours" — the second confirms it exists somewhere, which is a disclosure
     * in itself.
     */
    if (!(await revokeAgentKey({ keyId, merchantId }))) {
      return fail("NOT_FOUND", "No such key for this store", 404);
    }

    return ok({ revoked: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
