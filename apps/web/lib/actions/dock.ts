"use server";

import { isUuid } from "@workspace/db";
import type { DockReply } from "@/lib/data/dock";
import { dockReply, dockStarters } from "@/lib/data/dock";

/**
 * The dock, from the client.
 *
 * A panel that opens over whatever page you are on cannot be a server
 * component, and its answers are queries against the catalogue and the
 * basket — so the boundary is here. See `lib/data/dock.ts` for why the dock
 * answers from rows rather than from a model.
 *
 * Inputs are clamped, not validated: see the note in `./search.ts` about why
 * a thrown action is the wrong answer to a malformed prompt.
 */

const MAX_PROMPT = 500;

export async function dockReplyAction(
  prompt: string,
  productId?: string
): Promise<DockReply> {
  const asked = typeof prompt === "string" ? prompt.slice(0, MAX_PROMPT) : "";

  return await dockReply(asked, isUuid(productId) ? productId : undefined);
}

export async function dockStartersAction(hasProduct: boolean) {
  return await dockStarters(hasProduct === true);
}
