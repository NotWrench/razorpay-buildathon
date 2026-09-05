"use server";

import { revalidatePath } from "next/cache";
import {
  type IssuedAgentKey,
  issueAgentKey,
  revokeAgentKey,
} from "@/lib/api/agent-keys";
import { managerActor } from "@/lib/manager-store";
import { type ActionResult, failed, ok } from "./result";

/**
 * Issuing and revoking the credentials a buying agent trades with.
 *
 * The store is resolved from the session, never from the argument — a caller
 * who could pass a `merchantId` would be issuing keys against somebody else's
 * shop. The id the screen sends is checked against the one the session
 * resolves, so a mismatch is a refusal rather than a quiet write to the wrong
 * store.
 */

export async function issueAgentKeyAction(input: {
  label: string;
  merchantId: string;
  spendCapPaise?: number;
}): Promise<ActionResult<IssuedAgentKey>> {
  const { actorId, merchantId } = await managerActor();

  if (input.merchantId !== merchantId) {
    return failed("That is not your store.");
  }

  const label = input.label.trim();

  if (label.length < 2) {
    return failed("Give the key a name you will recognise later.");
  }

  const issued = await issueAgentKey({
    label,
    merchantId,
    spendCapPaise: input.spendCapPaise ?? null,
    userId: actorId,
  });

  revalidatePath("/manager/agents");

  return ok(issued);
}

export async function revokeAgentKeyAction(input: {
  keyId: string;
  merchantId: string;
}): Promise<ActionResult> {
  const { merchantId } = await managerActor();

  if (input.merchantId !== merchantId) {
    return failed("That is not your store.");
  }

  if (!(await revokeAgentKey({ keyId: input.keyId, merchantId }))) {
    return failed("No such key for this store.");
  }

  revalidatePath("/manager/agents");

  return ok();
}
