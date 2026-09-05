"use server";

import { z } from "zod";
import type { BuildSlotRow, SheetSlot } from "@/lib/data/recommend";
import { buildRowsFor } from "@/lib/data/recommend";

/**
 * Draws the sheet for a build the agent assembled.
 *
 * The `assembleBuild` tool returns ids and prices; the sheet needs images,
 * headline specs, a stock badge and the spec rows the compatibility engine
 * reads. This is the one hop between the two, and it exists rather than the
 * tool simply returning all of it because everything the tool returns is sent
 * to the model on every subsequent step — and the model has nothing to say
 * about an image URL.
 *
 * The payload is the model's own tool output round-tripping through the
 * browser, so it is validated like anything else that arrives over the wire:
 * ids are re-read under the store's own scope in `buildRowsFor`, and a slot
 * naming a product this store does not sell resolves to nothing and is
 * dropped.
 */

/** Eight slots, and a little room for a schema that grows. */
const MAX_SLOTS = 12;

/**
 * The tool's slot shape, named as the tool names it.
 *
 * `category` rather than `slug` because that is what the model is shown, and
 * this schema's whole job is to describe what actually arrives. Getting that
 * wrong is silent in the worst way: the parse fails, the sheet comes back
 * empty, and the only symptom is a build the agent clearly assembled and
 * talked about that never appears on screen.
 */
const slotSchema = z.object({
  category: z.string().max(40),
  productId: z.string().max(64),
  required: z.boolean().default(false),
  slot: z.string().max(40),
  upgrade: z
    .object({
      extraPaise: z.number().int(),
      productId: z.string().max(64),
      reason: z.string().max(200),
    })
    .nullish(),
});

const inputSchema = z.array(slotSchema).max(MAX_SLOTS);

function toSheetSlot(slot: z.infer<typeof slotSchema>): SheetSlot {
  return {
    productId: slot.productId,
    required: slot.required,
    slot: slot.slot,
    slug: slot.category,
    upgrade: slot.upgrade
      ? {
          deltaPaise: slot.upgrade.extraPaise,
          productId: slot.upgrade.productId,
          reason: slot.upgrade.reason,
        }
      : null,
  };
}

export async function buildSheetAction(
  slots: unknown
): Promise<BuildSlotRow[]> {
  const parsed = inputSchema.safeParse(slots);

  /*
   * A malformed payload is an empty sheet, not an exception. The prose the
   * model wrote about the build is already on screen and is still true; losing
   * the whole turn because a widget could not be drawn would be the worse
   * outcome by a distance.
   */
  if (!parsed.success) {
    return [];
  }

  return await buildRowsFor(parsed.data.map(toSheetSlot));
}
